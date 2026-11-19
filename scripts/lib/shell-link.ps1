<#
  Shared helper: reads and writes Windows shortcuts (.lnk) through the shell's own ShellLink object
  (CLSID_ShellLink + IShellLinkW + IPersistFile + IPropertyStore), so the property
  System.AppUserModel.ID (PKEY {9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}, 5) can be read and set.
  WScript.Shell cannot see that property. No network.

  Dot-source it:   . (Join-Path $PSScriptRoot 'lib\shell-link.ps1')
  Functions:
    Read-SukunaShortcut -Path <lnk>
        -> object: path targetPath workingDirectory arguments appUserModelId ('' when not set)
           Opens the file read-only (STGM_READ); never saves it.
    Write-SukunaShortcut -Path <lnk> -TargetPath <exe> -WorkingDirectory <dir> -AppUserModelId <id>
        Creates a new shortcut object (nothing of an old file at Path is kept) and saves it over Path.
    Set-SukunaShortcutAppUserModelId -Path <lnk> -AppUserModelId <id>
        Loads an existing shortcut, sets only the ID (everything else is kept) and saves it.

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
  NOTE: no param() block on purpose (dot-sourced).
#>

if (-not ('SukunaShellLink' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;

public static class SukunaShellLink {
    [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
    private class CShellLink { }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214F9-0000-0000-C000-000000000046")]
    private interface IShellLinkW {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszFile, int cch, IntPtr pfd, uint fFlags);
        void GetIDList(out IntPtr ppidl);
        void SetIDList(IntPtr pidl);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszName, int cch);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszDir, int cch);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszArgs, int cch);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
        void GetHotkey(out short pwHotkey);
        void SetHotkey(short wHotkey);
        void GetShowCmd(out int piShowCmd);
        void SetShowCmd(int iShowCmd);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszIconPath, int cch, out int piIcon);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, uint dwReserved);
        void Resolve(IntPtr hwnd, uint fFlags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
    }

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct PROPERTYKEY {
        public Guid fmtid;
        public uint pid;
    }

    // PROPVARIANT: 16 bytes on x86, 24 bytes on x64.
    [StructLayout(LayoutKind.Sequential)]
    private struct PROPVARIANT {
        public ushort vt;
        public ushort r1;
        public ushort r2;
        public ushort r3;
        public IntPtr p1;
        public IntPtr p2;
    }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
    private interface IPropertyStore {
        void GetCount(out uint cProps);
        void GetAt(uint iProp, out PROPERTYKEY pkey);
        void GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
        void SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
        void Commit();
    }

    [DllImport("ole32.dll")]
    private static extern int PropVariantClear(ref PROPVARIANT pvar);

    private const ushort VT_EMPTY = 0;
    private const ushort VT_LPWSTR = 31;
    private const int STGM_READ = 0;
    private const int STGM_READWRITE = 2;

    private static PROPERTYKEY AumidKey() {
        PROPERTYKEY k = new PROPERTYKEY();
        k.fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");
        k.pid = 5;
        return k;
    }

    private static void Release(object o) {
        if (o != null && Marshal.IsComObject(o)) { Marshal.FinalReleaseComObject(o); }
    }

    // Returns { targetPath, workingDirectory, arguments, appUserModelId }.
    public static string[] Read(string path) {
        object link = new CShellLink();
        try {
            ((IPersistFile)link).Load(path, STGM_READ);
            IShellLinkW sl = (IShellLinkW)link;
            StringBuilder target = new StringBuilder(32768);
            sl.GetPath(target, target.Capacity, IntPtr.Zero, 0);
            StringBuilder wd = new StringBuilder(32768);
            sl.GetWorkingDirectory(wd, wd.Capacity);
            StringBuilder args = new StringBuilder(32768);
            sl.GetArguments(args, args.Capacity);
            string id = "";
            IPropertyStore ps = (IPropertyStore)link;
            PROPERTYKEY key = AumidKey();
            PROPVARIANT pv;
            ps.GetValue(ref key, out pv);
            try {
                if (pv.vt == VT_LPWSTR && pv.p1 != IntPtr.Zero) { id = Marshal.PtrToStringUni(pv.p1); }
            } finally {
                PropVariantClear(ref pv);
            }
            return new string[] { target.ToString(), wd.ToString(), args.ToString(), id };
        } finally {
            Release(link);
        }
    }

    private static void SetId(object link, string id) {
        IPropertyStore ps = (IPropertyStore)link;
        PROPERTYKEY key = AumidKey();
        PROPVARIANT pv = new PROPVARIANT();
        pv.vt = VT_LPWSTR;
        pv.p1 = Marshal.StringToCoTaskMemUni(id);
        try {
            ps.SetValue(ref key, ref pv);
            ps.Commit();
        } finally {
            PropVariantClear(ref pv);
        }
    }

    public static void Write(string path, string target, string workingDirectory, string id) {
        object link = new CShellLink();
        try {
            IShellLinkW sl = (IShellLinkW)link;
            sl.SetPath(target);
            sl.SetWorkingDirectory(workingDirectory);
            SetId(link, id);
            ((IPersistFile)link).Save(path, true);
        } finally {
            Release(link);
        }
    }

    public static void SetAppUserModelId(string path, string id) {
        object link = new CShellLink();
        try {
            ((IPersistFile)link).Load(path, STGM_READWRITE);
            SetId(link, id);
            ((IPersistFile)link).Save(path, true);
        } finally {
            Release(link);
        }
    }
}
'@
}

function Read-SukunaShortcut {
    param([Parameter(Mandatory)][string]$Path)
    $v = [SukunaShellLink]::Read($Path)
    return [pscustomobject][ordered]@{
        path             = $Path
        targetPath       = $v[0]
        workingDirectory = $v[1]
        arguments        = $v[2]
        appUserModelId   = $v[3]
    }
}

function Write-SukunaShortcut {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$TargetPath,
        [Parameter(Mandatory)][string]$WorkingDirectory,
        [Parameter(Mandatory)][string]$AppUserModelId
    )
    [SukunaShellLink]::Write($Path, $TargetPath, $WorkingDirectory, $AppUserModelId)
}

function Set-SukunaShortcutAppUserModelId {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$AppUserModelId)
    [SukunaShellLink]::SetAppUserModelId($Path, $AppUserModelId)
}
