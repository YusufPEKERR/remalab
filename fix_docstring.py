# Resolve merge conflicts and fix docstring apostrophes in web_bridge.py
import re

filepath = r"c:\Users\YAREN\Desktop\remalab-web-tabanli\core\web_bridge.py"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Resolve merge conflicts: accept "origin/main" (theirs) version
# Pattern: <<<<<<< HEAD\n...incoming...\n=======\n...theirs...\n>>>>>>> origin/main
pattern = re.compile(
    r'<{7} HEAD\r?\n(.*?)\r?\n={7}\r?\n(.*?)\r?\n>{7} origin/main',
    re.DOTALL
)

matches = list(pattern.finditer(content))
print(f"Found {len(matches)} merge conflict(s)")

for i, m in enumerate(matches):
    ours = m.group(1)
    theirs = m.group(2)
    print(f"\nConflict {i+1}:")
    print(f"  HEAD lines: {len(ours.splitlines())}")
    print(f"  origin/main lines: {len(theirs.splitlines())}")

# Replace all conflicts with the "theirs" (origin/main) version
content = pattern.sub(lambda m: m.group(2), content)

# Verify no more conflict markers
remaining = content.count("<<<<<<< HEAD")
print(f"\nRemaining conflict markers: {remaining}")

# Now fix the docstring apostrophe issue for Python 3.14
# Find the specific problematic line
old = "service_statu tablosundaki"  # from our earlier fix attempt
if old in content:
    print("Found earlier fix attempt, leaving as-is")
else:
    old2 = "service_statu'daki"
    if old2 in content:
        # This is inside a """ docstring - Python 3.14 chokes on the apostrophe
        # when combined with Turkish UTF-8 chars on the same line
        content = content.replace(
            '"""warehouse.service_statu\'daki',
            '"""warehouse.service_statu tablosundaki'
        )
        print("Fixed docstring apostrophe")

with open(filepath, "w", encoding="utf-8", newline="") as f:
    f.write(content)

print("Done!")
