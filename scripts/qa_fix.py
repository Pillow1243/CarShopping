import pathlib, re

p = pathlib.Path('/home/user/carshop/scripts/qa.py')
s = p.read_text(encoding='utf-8')

# JS property path for #id selectors; data-attr selectors are handled explicitly below
def js(sel):
    m = re.fullmatch(r'#([A-Za-z][\w-]*)', sel)
    if m:
        return f"document.querySelector('#{m.group(1)}').click()"
    raise SystemExit('unhandled selector: ' + sel)

# simple #id clicks
s = re.sub(r"""(?:pg|m)\.click\(\s*['"]#([A-Za-z][\w-]*)['"]\s*\)""",
           lambda mo: f"{mo.group(0).split('.')[0]}.evaluate(\"document.querySelector('#{mo.group(1)}').click()\")",
           s)

repl = {
    """pg.click("#galFilters button[data-f='tune']")""":
        """pg.evaluate("document.querySelector('#galFilters button[data-f=\\'tune\\']').click()")""",
    """pg.click("#galFilters button[data-f='all']")""":
        """pg.evaluate("document.querySelector('#galFilters button[data-f=\\'all\\']').click()")""",
    """pg.click("#faq .q:nth-child(2) > button")""":
        """pg.evaluate("document.querySelectorAll('#faq .q')[1].querySelector('button').click()")""",
    """pg.click("#bookForm button[type=submit]")""":
        """pg.evaluate("document.querySelector('#bookForm button[type=submit]').click()")""",
    """m.click("#nav a[href='#plans']")""":
        """m.evaluate("document.querySelector(\\"#nav a[href='#plans']\\").click()")""",
}
for a, b in repl.items():
    if a in s:
        s = s.replace(a, b)
    else:
        raise SystemExit('missing: ' + a)

p.write_text(s, encoding='utf-8')
left = re.findall(r'(?:pg|m)\.click\([^)]*\)', s)
print('remaining .click( calls:', left)
