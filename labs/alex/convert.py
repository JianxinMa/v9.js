import base64

with open('main', 'rb') as fin:
    with open('main.base64', 'w') as fout:
        fout.write(base64.b64encode(fin.read()))
