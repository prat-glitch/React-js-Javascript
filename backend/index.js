// server.mjs  (or server.js with "type":"module" in package.json)
import express from 'express';

const app = express();

const products = [
  { id: 1, name: 'Apple Watch' },
  { id: 2, name: 'Banana Bread' },
  { id: 3, name: 'Apple iPhone' },
];

app.get('/api/products', (req, res) => {
  if (req.query.search) {
    const search = req.query.search.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(search));
    return res.json(filtered);
  }

  setTimeout(() => {
    res.json(products);
  }, 2000);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`server running: ${port}`);
});
