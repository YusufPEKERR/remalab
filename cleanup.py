import os
import re

for r, d, files in os.walk("ui"):
    for f in files:
        if f.endswith(".py"):
            path = os.path.join(r, f)
            with open(path, "r", encoding="utf-8") as file:
                content = file.read()
            # remove empty setStyleSheet("") and setStyleSheet(" ")
            content = re.sub(r"setStyleSheet\(\s*\"[ \t]*\"\s*\)", "", content)
            # remove lines ending with .setStyleSheet( and containing empty string on next lines.
            content = re.sub(r"\.setStyleSheet\(\s*f?\"[ \t]*\"\s*\)", "", content)
            # also remove background-color: transparent and border: none if they're isolated
            with open(path, "w", encoding="utf-8") as file:
                file.write(content)
