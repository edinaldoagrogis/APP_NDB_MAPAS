with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# We will replace the div click listener in showAutocomplete with mousedown/touchstart
old_code = r"""                div.addEventListener('click', function(e) {
                    searchInput.value = item;
                    autocompleteList.style.display = 'none';
                    handleSearch({ target: searchInput });
                });"""

new_code = r"""                const selectItem = function(e) {
                    e.preventDefault(); // Prevents input from losing focus and moving the dropdown
                    searchInput.value = item;
                    autocompleteList.style.display = 'none';
                    handleSearch({ target: searchInput });
                };
                div.addEventListener('mousedown', selectItem);
                div.addEventListener('touchstart', selectItem);"""

text = text.replace(old_code, new_code)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed dropdown click issue!')
