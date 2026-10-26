FROM nginx:alpine
# nginx сам сделает envsubst шаблона с переменными API_HOST / API_PORT
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY index.html config.js api.js app.js styles.css ./usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
EXPOSE 80