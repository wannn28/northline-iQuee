# Northline Supply

Demo print-on-demand storefront for posters and heavyweight tees. English UI, US dollars, made-to-order copy. Checkout is a fake card form: it does not call Stripe and it does not charge a card.

The only accepted test card is `4242 4242 4242 4242`. Any other number is declined.

## Run

```bash
npm install
npm run build
PORT=3018 HOST=127.0.0.1 npm start
```

`npm run dev` runs the API and Vite together.

## Admin

Open `/admin`. Password is the `ADMIN_PASSWORD` environment variable. If unset, the default is `northline-demo`.

## Data

SQLite file: `data/northline.db`. Products are seeded on first launch (8 items). Orders are written only after a successful demo checkout.
