# Use official PHP Apache image
FROM php:8.1-apache

# Enable CURL extension
RUN docker-php-ext-install curl

# Copy project files to Apache root
COPY . /var/www/html/

# Expose port 80
EXPOSE 80
