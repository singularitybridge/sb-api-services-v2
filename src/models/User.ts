import mongoose, { Document, Schema } from 'mongoose';

interface IUser extends Document {
    name: string;
    phoneNumber: string;
}

const UserSchema: Schema = new Schema({
    name: { type: String, required: true },
    phoneNumber: { type: String, required: true, unique: true },
});

const User = mongoose.model<IUser>('User', UserSchema);

export default User;