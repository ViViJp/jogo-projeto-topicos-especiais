FROM nginxinc/nginx-unprivileged:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
ADD dist /usr/share/nginx/html/
EXPOSE 8080
