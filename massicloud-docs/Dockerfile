FROM nginx:alpine

COPY dist/ /usr/share/nginx/html/

RUN cat > /etc/nginx/conf.d/default.conf <<'NGINX'
server {
    listen 80;
    root /usr/share/nginx/html;

    # Redirect root to English by default
    location = / {
        return 302 /en/;
    }

    # For everything else, try to serve the file, or fall back to 404
    location / {
        try_files $uri $uri/ $uri.html $uri/index.html =404;
    }

    # Custom 404
    error_page 404 /404.html;
}
NGINX
