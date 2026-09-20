with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_code = r"""                div.onclick = function() {
                    weedSearchInput.value = match;
                    weedDropdown.style.display = 'none';
                    handleSearch({ target: weedSearchInput });
                };"""

new_code = r"""                const selectWeedItem = function(e) {
                    e.preventDefault();
                    weedSearchInput.value = match;
                    weedDropdown.style.display = 'none';
                    handleSearch({ target: weedSearchInput });
                };
                div.addEventListener('mousedown', selectWeedItem);
                div.addEventListener('touchstart', selectWeedItem);"""

text = text.replace(old_code, new_code)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed weed dropdown!')
