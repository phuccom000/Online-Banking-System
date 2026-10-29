import zipfile
import re

z = zipfile.ZipFile('Final_Assignment.docx')
xml = z.read('word/document.xml').decode('utf-8', errors='ignore')
txt = re.sub(r'<[^>]+>', ' ', xml)
txt = re.sub(r'\s+', ' ', txt)
with open('assignment_content.txt', 'w', encoding='utf-8') as f:
    f.write(txt)
print('done')
z.close()
