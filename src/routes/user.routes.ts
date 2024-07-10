// File: src/routes/user.routes.ts
import express from 'express';
import { User } from '../models/User';

const userRouter = express.Router();


userRouter.get('/', async (req, res) => {
  try {
    const users = await User.find({});
    res.send(users);
  } catch (error) {
    res.status(500).send({ message: `Error getting users: ${error}` });
  }
});


userRouter.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    res.send(user);
  } catch (error) {
    res.status(500).send({ message: `Error getting user: ${error}` });
  }
});

// Add a new user
userRouter.post('/', async (req, res) => {
  try {
    const userData = req.body;
    const newUser = new User(userData);
    await newUser.save();
    res.status(201).send(newUser);
  } catch (error) {
    res.status(500).send({ message: `Error creating user: ${error}` });
  }
});

// Update a user
userRouter.put('/:id', async (req, res) => {
  const { id } = req.params;
  const userData = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(id, userData, {
      new: true,
    });
    if (!updatedUser) {
      return res.status(404).send({ message: 'User not found' });
    }
    res.send(updatedUser);
  } catch (error) {
    res.status(500).send({ message: `Error updating user: ${error}` });
  }
});

// Delete a user
userRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    await User.findByIdAndDelete(id);
    res.send({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).send({ message: `Error deleting user: ${error}` });
  }
});

export { userRouter };
