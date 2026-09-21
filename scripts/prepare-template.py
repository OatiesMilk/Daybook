"""Prepare a reusable DAR template without changing the source document."""
import re
import sys
import zipfile
from pathlib import Path

source = Path(sys.argv[1] if len(sys.argv) > 1 else 'DAR_Akia_091726.docx')
target = Path('templates/dar-template.docx')

def set_cell(cell, text):
    values = iter([text])
    if text.startswith(('Name:', 'Date:', 'School:', 'Department/Team:', 'Hours rendered:')) and len(re.findall(r'<w:t\b', cell)) > 1:
        label, token = text.split('{', 1)
        values = iter([label, '{' + token])
    def replace(match):
        value = next(values, '')
        return '<w:t xml:space="preserve">' + value + '</w:t>'
    return re.sub(r'<w:t\b[^>]*>.*?</w:t>', replace, cell, flags=re.S)

with zipfile.ZipFile(source) as archive:
    xml = archive.read('word/document.xml').decode('utf-8')
    tables = re.findall(r'<w:tbl\b[^>]*>.*?</w:tbl>', xml, re.S)
    if len(tables) != 2:
        raise ValueError('Expected the two tables in the supplied DAR sample')
    header_fields = iter(['Name: {full_name}', 'Date: {date}', 'School: {school}',
                          'Department/Team: {department}', 'Hours rendered: {hours}', ''])
    header = re.sub(r'<w:tc\b[^>]*>.*?</w:tc>', lambda m: set_cell(m[0], next(header_fields)), tables[0], flags=re.S)
    rows = re.findall(r'<w:tr\b[^>]*>.*?</w:tr>', tables[1], re.S)
    fields = iter(['{#activities}{project}', '{task}', '{status}', '{remarks}{/activities}'])
    row = re.sub(r'<w:tc\b[^>]*>.*?</w:tc>', lambda m: set_cell(m[0], next(fields)), rows[1], flags=re.S)
    row = re.sub(r'<w:trHeight\b[^>]*/>', '', row)
    row = re.sub(r'<w:cantSplit\b[^>]*/>', '<w:cantSplit/>', row)
    table = tables[1].replace(''.join(rows), rows[0] + row)
    # Repeat column titles on subsequent pages without changing first-page layout.
    table = table.replace(rows[0], re.sub(r'<w:tblHeader\b[^>]*/>', '<w:tblHeader/>', rows[0]))
    xml = xml.replace(tables[0], header).replace(tables[1], table)
    target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as output:
        for entry in archive.infolist():
            data = archive.read(entry.filename)
            if entry.filename == 'word/document.xml': data = xml.encode('utf-8')
            if entry.filename.startswith('word/header') and entry.filename.endswith('.xml'):
                # Keep the same label as ordinary header text: LibreOffice clips
                # the source's Word-only text shape, whose fallback is blank.
                header_xml = data.decode('utf-8')
                header_xml = re.sub(r'<mc:AlternateContent>.*?</mc:AlternateContent>', '<w:t>DAR v2</w:t>', header_xml, flags=re.S)
                header_xml = re.sub(r'w:line="14\.399999999999999"', 'w:line="240"', header_xml)
                data = header_xml.encode('utf-8')
            if entry.filename == 'docProps/core.xml':
                core = data.decode('utf-8')
                core = re.sub(r'(<(?:dc:creator|cp:lastModifiedBy)>).*?(</(?:dc:creator|cp:lastModifiedBy)>)', r'\1Daybook\2', core)
                data = core.encode('utf-8')
            output.writestr(entry, data)
print(target)
