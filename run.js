import express from 'express';

const app = express();
app.use(express.static('static'));

app.listen(3000, () => console.log('Dashboard running on http://localhost:3000'));