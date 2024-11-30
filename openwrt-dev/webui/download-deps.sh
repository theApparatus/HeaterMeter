#!/bin/bash

# Create directories if they don't exist
mkdir -p css js webfonts

# Download jQuery
curl -L https://code.jquery.com/jquery-3.6.0.min.js -o js/jquery.min.js

# Download Flot for graphs
curl -L https://cdnjs.cloudflare.com/ajax/libs/flot/0.8.3/jquery.flot.min.js -o js/jquery.flot.min.js
curl -L https://cdnjs.cloudflare.com/ajax/libs/flot/0.8.3/jquery.flot.time.min.js -o js/jquery.flot.time.min.js

# Download Font Awesome files
curl -L https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css -o css/fontawesome.min.css
curl -L https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/solid.min.css -o css/solid.min.css
curl -L https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/regular.min.css -o css/regular.min.css
curl -L https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2 -o webfonts/fa-solid-900.woff2
curl -L https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.ttf -o webfonts/fa-solid-900.ttf
curl -L https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2 -o webfonts/fa-regular-400.woff2
curl -L https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.ttf -o webfonts/fa-regular-400.ttf

echo "All dependencies downloaded successfully!"
