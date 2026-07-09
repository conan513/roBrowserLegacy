FROM php:8.3-apache AS server

LABEL org.opencontainers.image.description="Creates a environment to serve PHP files for the Remote Client API."

WORKDIR /var/www/html

USER root

RUN apt-get update -y -qq && \
  a2enmod rewrite && \
  a2enmod headers

# Ensure cache, logs and data directories exist with proper permissions
RUN mkdir -p /var/www/html/cache /var/www/html/logs /var/www/html/data && \
    chown -R www-data:www-data /var/www/html/cache /var/www/html/logs /var/www/html/data && \
    chmod -R 755 /var/www/html/cache /var/www/html/logs /var/www/html/data

EXPOSE 80

USER www-data
