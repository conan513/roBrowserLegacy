FROM php:8.3-apache

LABEL org.opencontainers.image.description="Creates a environment to serve PHP files for the Remote Client API."

WORKDIR /var/www/html

USER root

RUN apt-get update -y -qq && \
  apt-get install -y -qq libpng-dev libjpeg-dev libfreetype6-dev && \
  docker-php-ext-configure gd --with-freetype --with-jpeg && \
  docker-php-ext-install gd && \
  a2enmod rewrite && \
  a2enmod headers && \
  a2enmod deflate && \
  a2enmod speling

RUN rm -f /etc/apache2/sites-available/000-default.conf

RUN <<'EOF' cat >> /etc/apache2/sites-available/000-default.conf
<VirtualHost *:80>
    DocumentRoot /var/www/html
    ErrorDocument 404 /index.php

    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined

    # Pass environment variables to PHP
    PassEnv DEBUG CLIENT_RESPATH CLIENT_DATAINI CACHE_ENABLED INDEX_CACHE_ENABLED GRF_ENCODING CACHE_MAX_FILES CACHE_MAX_MEMORY_MB CLIENT_ENABLESEARCH CLIENT_AUTOEXTRACT MEMORY_LIMIT COMPRESSION_ENABLED COMPRESSION_MIN_SIZE COMPRESSION_LEVEL PATH_MAPPING_ENABLED PATH_MAPPING_FILE MISSING_LOG_ENABLED MISSING_LOG_FILE MISSING_LOG_MAX_ENTRIES WARM_CACHE_ENABLED WARM_CACHE_MAX_FILES WARM_CACHE_MAX_MEMORY_MB INDEX_CACHE_DIR

    <IfModule mod_headers.c>
        Header set Access-Control-Allow-Origin "*"
        Header set Access-Control-Allow-Headers "X-Application"
    </IfModule>
    <Directory /var/www/html>
        Options +FollowSymLinks -MultiViews
        AllowOverride All
        Require all granted

        <IfModule mod_rewrite.c>
            RewriteEngine On
            RewriteRule ^(.*)\.bmp$ $1\.png [NC,QSA]
        </IfModule>

        <IfModule mod_speling.c>
            CheckSpelling Off
        </IfModule>
    </Directory>

    <IfModule mod_gzip.c>
        mod_gzip_on Yes
        mod_gzip_dechunk Yes
        mod_gzip_item_include file \.(act|spr|pal|txt|xml|lua|lub|gnd|gat|rsw|rsm)$
    </IfModule>

    <IfModule mod_mime.c>
        AddType application/ro-action          .act
        AddType application/ro-sprite          .spr
        AddType application/ro-palette         .pal
        AddType application/ro-ground          .gnd
        AddType application/ro-altitude        .gat
        AddType application/ro-world           .rsw
        AddType application/ro-model           .rsm
        AddType text/plain                     .lua
        AddType text/plain                     .lub
        AddType image/bmp                      .bmp
    </IfModule>

    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE \
            application/ro-action \
            application/ro-sprite \
            application/ro-palette \
            application/ro-ground \
            application/ro-altitude \
            application/ro-world \
            application/ro-model \
            text/plain \
            application/xml \
            image/bmp \
            image/png \
            image/jpeg
    </IfModule>

</VirtualHost>
EOF

EXPOSE 80

USER www-data
