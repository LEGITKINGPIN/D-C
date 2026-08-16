import os

file_path = "src/components/SiteComponents.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "filteredItems.map((item: any, idx) => (" in line:
        lines[i] = line.replace("filteredItems.map((item: any, idx) => (", "filteredItems.filter((i: any) => i.playbackId).map((item: any, idx) => (")
    if "<PortfolioItem" in line and "key={item.id}" in lines[i+1]:
        lines[i+1] = lines[i+1].replace("key={item.id}", "key={item._id}")
    if "items.map((item: any, idx) => (" in line:
        lines[i] = line.replace("items.map((item: any, idx) => (", "items.filter((i: any) => i.playbackId).map((item: any, idx) => (")
    if "key={clip.id}" in line and "ClipCard" in lines[i-1]:
        lines[i] = line.replace("key={clip.id}", "key={clip._id}")

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)
print("Keys and filters fixed!")
