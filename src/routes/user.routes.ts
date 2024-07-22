// File: src/routes/user.routes.ts
import express from 'express';
import { User } from '../models/User';
import { verifyAccess, AuthenticatedRequest } from '../middleware/auth.middleware';

const userRouter = express.Router();

// Get all users (admin only)
userRouter.get('/', verifyAccess(true), async (req: AuthenticatedRequest, res) => {
  try {
    const users = await User.find({});
    res.send(users);
  } catch (error) {
    res.status(500).send({ message: `Error getting users: ${error}` });
  }
});

// Get user by ID (admin or same company user)
userRouter.get('/:id', verifyAccess(), async (req: AuthenticatedRequest, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    
    // Check if the requester is an admin or from the same company
    if (req.user?.role !== 'Admin' && user.companyId.toString() !== req.user?.companyId.toString()) {
      return res.status(403).send({ message: 'Access denied' });
    }
    
    res.send(user);
  } catch (error) {
    res.status(500).send({ message: `Error getting user: ${error}` });
  }
});

// Add a new user (admin only)
userRouter.post('/', verifyAccess(true), async (req: AuthenticatedRequest, res) => {
  try {
    const userData = req.body;
    const newUser = new User(userData);
    await newUser.save();
    res.status(201).send(newUser);
  } catch (error) {
    res.status(500).send({ message: `Error creating user: ${error}` });
  }
});

// Update a user (admin only)
userRouter.put('/:id', verifyAccess(true), async (req: AuthenticatedRequest, res) => {
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

// Delete a user (admin only)
userRouter.delete('/:id', verifyAccess(true), async (req: AuthenticatedRequest, res) => {
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