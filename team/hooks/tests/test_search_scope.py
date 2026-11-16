"""Glob・Grep の探す範囲（フックの直し 5a）のテスト。2026-11-16（U2: ユーザーの判断で当てた）。

- 5a は速さのための決まりで、秘密の守りではない。探す範囲が tmp/・tmp/b/・tmp/b/wt/・tmp/b/cache/ そのものなら止める。
  プロジェクト直下からの Glob は、pattern の波括弧を展開した選択肢のどれかが tmp で始まるか、最初の区切りが tmp に
  当たりうるワイルドカードで ** を含むときに止める（**/*.md・*/b/**・t?p/** など）。d*/**・{docs,scripts}/**/*.md のように
  tmp に当たらないものは通す。先頭の空・.・空白だけの区切りは飛ばし、\\ は区切りとエスケープの両方の読み方で見る。
- 判定は本物の permissions.json（v2-1）と本物のフックで、tmp/b の偽の木を持つ写しのプロジェクトを使う。
  狄仁傑は read_paths を絞った（U3）ので、path を省いた Glob はどれも read_paths で止まる。5a の通す形・止める形は
  蒙恬・大岡越前守・組み込みの Explore で確かめ、狄仁傑は path を渡した形で確かめる（JudgeSearchTest）。
- 出典: Team の tasks/2026-11-16-ai-editor-move-off-c-perms/perm-tests/ の test_e_search_scope.py（SearchScopeTest）、
  test_l_round2_cwd_glob.py（GlobOverBlockTest）、test_m_round3.py（GlobOddFormsTest）、test_o_round5.py（wt-r2）。

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import unittest

from hookrun import BuildTreeTestCase

MT, OE, DR = "meng-tian", "ooka-echizen", "di-renjie"
WHO = (MT, OE, "Explore")


class SearchCase(BuildTreeTestCase):
    def tool_passes(self, members, cases):
        for member in members:
            for tool, tool_input in cases:
                with self.subTest(member=member, tool=tool, tool_input=tool_input):
                    self.assertPass(self.ev(tool, tool_input, member))

    def tool_blocks(self, members, cases, contains=None):
        for member in members:
            for tool, tool_input in cases:
                with self.subTest(member=member, tool=tool, tool_input=tool_input):
                    self.assertBlock(self.ev(tool, tool_input, member), contains)


class SearchScopeTest(SearchCase):
    def blocked_inputs(self):
        p = self.project
        return [
            ("Glob", {"pattern": "**/*.md"}),
            ("Glob", {"pattern": "**/package.json", "path": str(p)}),
            ("Glob", {"pattern": "tmp/**/*.ts"}),
            ("Glob", {"pattern": "tmp/b/wt/w1/src/**/*.ts"}),
            ("Glob", {"pattern": "./**/*.md"}),
            ("Glob", {"pattern": "*/b/wt/**"}),
            ("Glob", {"pattern": "{docs,tmp}/**/*.md"}),
            ("Glob", {"pattern": "*.ts", "path": str(p / "tmp")}),
            ("Glob", {"pattern": "**/*.ts", "path": str(p / "tmp" / "b")}),
            ("Glob", {"pattern": "*", "path": str(p / "tmp" / "b" / "wt")}),
            ("Glob", {"pattern": "*", "path": "tmp/b/wt"}),
            ("Glob", {"pattern": "**/*.zip", "path": str(p / "tmp" / "b" / "cache")}),
            ("Glob", {"pattern": "*", "path": str(p / "TMP" / "B")}),
            ("Grep", {"pattern": "x", "path": str(p / "tmp")}),
            ("Grep", {"pattern": "x", "path": str(p / "tmp" / "b")}),
            ("Grep", {"pattern": "x", "path": str(p / "tmp" / "b" / "wt")}),
            ("Grep", {"pattern": "x", "path": str(p / "tmp" / "b" / "cache")}),
        ]

    def allowed_inputs(self):
        p = self.project
        return [
            ("Glob", {"pattern": "**/*.md", "path": str(p / "docs")}),
            ("Glob", {"pattern": "docs/**/*.md"}),
            ("Glob", {"pattern": "*.md"}),
            ("Glob", {"pattern": "*/package.json"}),
            ("Glob", {"pattern": "scripts/*.mjs", "path": str(p)}),
            ("Glob", {"pattern": "**/*.ts", "path": str(p / "tmp" / "b" / "wt" / "w1")}),
            ("Glob", {"pattern": "*.json", "path": str(p / "tmp" / "b" / "smoke")}),
            ("Grep", {"pattern": "x"}),
            ("Grep", {"pattern": "x", "glob": "**/*.md"}),
            ("Grep", {"pattern": "x", "path": str(p / "docs")}),
            ("Grep", {"pattern": "x", "path": str(p / "tmp" / "b" / "wt" / "w1")}),
            ("Grep", {"pattern": "x", "path": str(p / "tmp" / "b" / "netlog")}),
            ("Read", {"file_path": str(p / "tmp" / "b" / "wt" / "w1" / "a.ts")}),
        ]

    def test_blocks_heavy_roots(self):
        self.tool_blocks(WHO, self.blocked_inputs(), "tmp/")

    def test_allows_narrow_searches(self):
        self.tool_passes(WHO, self.allowed_inputs())

    def test_wt_r2_is_not_a_heavy_root(self):
        # 5a は tmp/b/wt を止めるが tmp/b/wt-r2 を止めない（探す範囲の決まりは経験則。R6・R19）
        self.tool_passes((MT,), [("Glob", {"pattern": "*", "path": "tmp/b/wt-r2"})])


class GlobOverBlockTest(SearchCase):
    """2回目の改訂 F6: 波括弧の選択肢を全部見て、最初の区切りが tmp に当たりえなければ通す。"""

    PASS = ["d*/**", "{docs,scripts}/**/*.md", "{docs,scripts,src}/**", "[ds]*/**", "s?ripts/**", "?/**",
            "docs/**/*.md", "*.md", "*/package.json", "{docs,scripts}/*.md", "./docs/**", "{docs/**,scripts/**}",
            "*/b/x", "D*/**/*.ts", "[!t]*/**", "[^t]*/**"]
    BLOCK = ["**/*.md", "**", "*/b/**", "*/**/*.mjs", "{docs,tmp}/**", "{docs,TMP}/**/*.md", "t?p/**", "[t]mp/**",
             "[!x]mp/**", "T*/**", "???/**", "tmp/**", "tmp", "{tmp/**,docs/**}", "{./tmp,docs}/**",
             "{a,{tmp,b}}/**", "{tmp/**", "!(docs)/**", "@(tmp)/**", "+(t)mp/**", "{d,t}*/**", "*{p,s}/**"]

    def test_pass(self):
        self.tool_passes(WHO, [("Glob", {"pattern": p}) for p in self.PASS])

    def test_block(self):
        self.tool_blocks(WHO, [("Glob", {"pattern": p}) for p in self.BLOCK], "tmp/")


class GlobOddFormsTest(SearchCase):
    """3回目の改訂 N3: 先頭の空・.・空白だけの区切りと、\\ の2つの読み方。"""

    BLOCK = [".//tmp/**", "././/tmp/**", "./ /tmp/**", "t\\mp/**", "tm\\p/**",
             ".///tmp/**/*.md", "./././tmp/**", " /tmp/**", "{docs,t\\mp}/**", "././/t?p/**"]
    PASS = ["docs\\**\\*.md", "scripts\\*.mjs", ".//docs/**", "./docs/**/*.md", "./ /docs/**", "*\\package.json",
            "d\\ocs/**", "docs/**/*.md", "d*/**", "*.md"]

    def test_block(self):
        self.tool_blocks(WHO, [("Glob", {"pattern": p}) for p in self.BLOCK], "tmp/")

    def test_pass(self):
        self.tool_passes(WHO, [("Glob", {"pattern": p}) for p in self.PASS])


class JudgeSearchTest(SearchCase):
    """狄仁傑（read_paths は TAKE-IN.md・docs/・records/take-in/。U3）の探す範囲。path を渡せば通り、省けば read_paths
    で止まる（R21）。tmp/ は read_paths の外。"""

    def test_with_path(self):
        self.tool_passes((DR,), [("Glob", {"pattern": "**/*.md", "path": "docs"}),
                                 ("Glob", {"pattern": "**/*.json", "path": "records/take-in"}),
                                 ("Grep", {"pattern": "x", "path": "records/take-in", "glob": "**/*.md"})])

    def test_without_path_or_outside(self):
        self.tool_blocks((DR,), [("Glob", {"pattern": "docs/**/*.md"}), ("Glob", {"pattern": "*.md"}),
                                 ("Grep", {"pattern": "x"}), ("Glob", {"pattern": "*", "path": "tmp/b/wt/w1"}),
                                 ("Grep", {"pattern": "x", "path": "tmp/b/netlog"})], "読むことを許可していない")


if __name__ == "__main__":
    unittest.main()
