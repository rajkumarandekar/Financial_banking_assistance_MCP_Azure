FROM node:18-alpine AS build

# make the 'app' folder the current working directory
WORKDIR /app

COPY . .

# install project dependencies
RUN npm install
RUN npm run build

FROM nginx:alpine

WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist .
COPY --from=build /app/nginx/nginx.conf.template /etc/nginx/conf.d

EXPOSE 80

CMD ["/bin/sh", "-c", "envsubst '$CHATKIT_BASE_URL $TRANSACTION_API_BASE_URL $ACCOUNT_API_BASE_URL $PAYMENT_API_BASE_URL $CUSTOMER_API_BASE_URL $LOAN_API_BASE_URL $CREDIT_API_BASE_URL $DOCUMENT_API_BASE_URL $COMMUNICATION_API_BASE_URL $INVESTMENT_API_BASE_URL' < /etc/nginx/conf.d/nginx.conf.template > /etc/nginx/conf.d/default.conf && nginx -g \"daemon off;\""]
