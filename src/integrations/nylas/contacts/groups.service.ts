/**
 * Nylas Contact Groups Service (Simplified)
 *
 * Provides basic group management for organizing contacts.
 */

import mongoose from 'mongoose';
import { ContactGroup } from './models/ContactGroup';
import { ContactMetadata } from './models/ContactMetadata';

// ==========================================
// Group CRUD Operations
// ==========================================

export async function createGroup(
  companyId: string,
  userId: string,
  name: string,
  description?: string,
) {
  console.log('[GROUPS] Creating group:', name);

  // Check for duplicate name
  const existing = await ContactGroup.findOne({
    companyId: new mongoose.Types.ObjectId(companyId),
    name,
    isDeleted: false,
  });

  if (existing) {
    throw new Error(`Group "${name}" already exists`);
  }

  const group = new ContactGroup({
    name,
    description,
    companyId: new mongoose.Types.ObjectId(companyId),
    ownerId: new mongoose.Types.ObjectId(userId),
    memberCount: 0,
  });

  await group.save();
  console.log('[GROUPS] Group created:', group._id);

  return group;
}

export async function getGroup(groupId: string, companyId: string) {
  console.log('[GROUPS] Getting group:', groupId);

  return await ContactGroup.findOne({
    _id: new mongoose.Types.ObjectId(groupId),
    companyId: new mongoose.Types.ObjectId(companyId),
    isDeleted: false,
  });
}

export async function updateGroup(
  groupId: string,
  companyId: string,
  updates: { name?: string; description?: string },
) {
  console.log('[GROUPS] Updating group:', groupId);

  const group = await ContactGroup.findOne({
    _id: new mongoose.Types.ObjectId(groupId),
    companyId: new mongoose.Types.ObjectId(companyId),
    isDeleted: false,
  });

  if (!group) {
    throw new Error('Group not found');
  }

  if (updates.name !== undefined) {
    // Check for duplicate name
    const existing = await ContactGroup.findOne({
      companyId: new mongoose.Types.ObjectId(companyId),
      name: updates.name,
      isDeleted: false,
      _id: { $ne: group._id },
    });

    if (existing) {
      throw new Error(`Group "${updates.name}" already exists`);
    }

    group.name = updates.name;
  }

  if (updates.description !== undefined) {
    group.description = updates.description;
  }

  await group.save();
  console.log('[GROUPS] Group updated');

  return group;
}

export async function deleteGroup(
  groupId: string,
  companyId: string,
) {
  console.log('[GROUPS] Deleting group:', groupId);

  const group = await ContactGroup.findOne({
    _id: new mongoose.Types.ObjectId(groupId),
    companyId: new mongoose.Types.ObjectId(companyId),
    isDeleted: false,
  });

  if (!group) {
    throw new Error('Group not found');
  }

  // Soft delete
  group.isDeleted = true;
  await group.save();

  // Remove group from all contacts
  await ContactMetadata.updateMany(
    { groups: group._id },
    { $pull: { groups: group._id } }
  );

  console.log('[GROUPS] Group deleted');
}

// ==========================================
// Group Membership Operations
// ==========================================

export async function addContactToGroup(
  groupId: string,
  contactId: string,
  grantId: string,
  companyId: string,
) {
  console.log('[GROUPS] Adding contact to group:', { groupId, contactId });

  const group = await ContactGroup.findOne({
    _id: new mongoose.Types.ObjectId(groupId),
    companyId: new mongoose.Types.ObjectId(companyId),
    isDeleted: false,
  });

  if (!group) {
    throw new Error('Group not found');
  }

  let metadata = await ContactMetadata.findOne({
    contactId,
    grantId,
    isDeleted: false,
  });

  if (!metadata) {
    throw new Error('Contact not found');
  }

  if (!metadata.groups.includes(group._id)) {
    metadata.groups.push(group._id);
    await metadata.save();

    await group.updateMemberCount();
    await group.save();

    console.log('[GROUPS] Contact added');
  } else {
    console.log('[GROUPS] Contact already in group');
  }
}

export async function removeContactFromGroup(
  groupId: string,
  contactId: string,
  grantId: string,
  companyId: string,
) {
  console.log('[GROUPS] Removing contact from group:', { groupId, contactId });

  const group = await ContactGroup.findOne({
    _id: new mongoose.Types.ObjectId(groupId),
    companyId: new mongoose.Types.ObjectId(companyId),
    isDeleted: false,
  });

  if (!group) {
    throw new Error('Group not found');
  }

  const metadata = await ContactMetadata.findOne({
    contactId,
    grantId,
    isDeleted: false,
  });

  if (!metadata) {
    throw new Error('Contact not found');
  }

  metadata.groups = metadata.groups.filter(
    (g: mongoose.Types.ObjectId) => g.toString() !== group._id.toString()
  );
  await metadata.save();

  await group.updateMemberCount();
  await group.save();

  console.log('[GROUPS] Contact removed');
}
