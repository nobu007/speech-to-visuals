import { app } from './server';

const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
