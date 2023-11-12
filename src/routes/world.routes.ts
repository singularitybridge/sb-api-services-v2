
import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  const date = new Date();
  const time = date.toLocaleTimeString();
  const month = date.getMonth();
  let season = '';
  if (month >= 2 && month <= 4) {
    season = 'spring';
  } else if (month >= 5 && month <= 7) {
    season = 'summer';
  } else if (month >= 8 && month <= 10) {
    season = 'autumn';
  } else {
    season = 'winter';
  }
  const hour = date.getHours();
  let dayStatus = '';
  if (hour >= 5 && hour <= 11) {
    dayStatus = 'morning';
  } else if (hour >= 12 && hour <= 16) {
    dayStatus = 'afternoon';
  } else if (hour >= 17 && hour <= 19) {
    dayStatus = 'evening';
  } else {
    dayStatus = 'night';
  }
  res.json({
    time,
    season,
    dayStatus,
  });
});

export default router;
