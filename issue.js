const { UserInputError } = require('apollo-server-express');
const { getDb, getNextSequence } = require('./db.js');
const { mustBeSignedIn } = require('./auth.js');

const PAGE_SIZE = 10;

async function get(_, { id }) {
  const db = getDb();
  try {
    return await db.collection('issues').findOne({ id });
  } catch (error) {
    console.error('Error fetching issue:', error);
    throw new Error('Failed to fetch issue');
  }
}

async function list(_, { status, effortMin, effortMax, page, search }) {
  const db = getDb();
  const filter = {};

  if (status) filter.status = status;
  if (effortMin !== undefined || effortMax !== undefined) {
    filter.effort = {};
    if (effortMin !== undefined) filter.effort.$gte = effortMin;
    if (effortMax !== undefined) filter.effort.$lte = effortMax;
  }
  if (search) filter.$text = { $search: search };

  try {
    const cursor = db.collection('issues').find(filter)
      .sort({ id: 1 })
      .skip(PAGE_SIZE * (page - 1))
      .limit(PAGE_SIZE);

    const totalCount = await cursor.count(false);
    const issues = await cursor.toArray();
    const pages = Math.ceil(totalCount / PAGE_SIZE);

    return { issues, pages };
  } catch (error) {
    console.error('Error listing issues:', error);
    throw new Error('Failed to list issues');
  }
}

function validate(issue) {
  const errors = [];
  if (issue.title.length < 3) {
    errors.push('Field "title" must be at least 3 characters long.');
  }
  if (issue.status === 'Assigned' && !issue.owner) {
    errors.push('Field "owner" is required when status is "Assigned".');
  }
  if (errors.length > 0) {
    throw new UserInputError('Invalid input(s)', { errors });
  }
}

async function add(_, { issue }) {
  const db = getDb();
  validate(issue);

  const newIssue = {
    ...issue,
    created: new Date(),
    id: await getNextSequence('issues'),
  };

  try {
    const result = await db.collection('issues').insertOne(newIssue);
    return await db.collection('issues').findOne({ _id: result.insertedId });
  } catch (error) {
    console.error('Error adding issue:', error);
    throw new Error('Failed to add issue');
  }
}

async function update(_, { id, changes }) {
  const db = getDb();
  if (changes.title || changes.status || changes.owner) {
    const issue = await db.collection('issues').findOne({ id });
    Object.assign(issue, changes);
    validate(issue);
  }

  try {
    await db.collection('issues').updateOne({ id }, { $set: changes });
    return await db.collection('issues').findOne({ id });
  } catch (error) {
    console.error('Error updating issue:', error);
    throw new Error('Failed to update issue');
  }
}

async function remove(_, { id }) {
  const db = getDb();
  const issue = await db.collection('issues').findOne({ id });
  if (!issue) return false;

  try {
    issue.deleted = new Date();
    const result = await db.collection('deleted_issues').insertOne(issue);
    if (result.insertedId) {
      const deletionResult = await db.collection('issues').deleteOne({ id });
      return deletionResult.deletedCount === 1;
    }
    return false;
  } catch (error) {
    console.error('Error removing issue:', error);
    throw new Error('Failed to remove issue');
  }
}

async function counts(_, { status, effortMin, effortMax }) {
  const db = getDb();
  const filter = {};

  if (status) filter.status = status;
  if (effortMin !== undefined || effortMax !== undefined) {
    filter.effort = {};
    if (effortMin !== undefined) filter.effort.$gte = effortMin;
    if (effortMax !== undefined) filter.effort.$lte = effortMax;
  }

  try {
    const results = await db.collection('issues').aggregate([
      { $match: filter },
      { $group: { _id: { owner: '$owner', status: '$status' }, count: { $sum: 1 } } },
    ]).toArray();

    const stats = {};
    results.forEach((result) => {
      const { owner, status: statusKey } = result._id;
      if (!stats[owner]) stats[owner] = { owner };
      stats[owner][statusKey] = result.count;
    });

    return Object.values(stats);
  } catch (error) {
    console.error('Error getting issue counts:', error);
    throw new Error('Failed to get issue counts');
  }
}

async function restore(_, { id }) {
  const db = getDb();
  const issue = await db.collection('deleted_issues').findOne({ id });
  if (!issue) return false;

  try {
    issue.deleted = new Date();
    const result = await db.collection('issues').insertOne(issue);
    if (result.insertedId) {
      const deletionResult = await db.collection('deleted_issues').deleteOne({ id });
      return deletionResult.deletedCount === 1;
    }
    return false;
  } catch (error) {
    console.error('Error restoring issue:', error);
    throw new Error('Failed to restore issue');
  }
}

module.exports = {
  list,
  add: mustBeSignedIn(add),
  get,
  update: mustBeSignedIn(update),
  delete: mustBeSignedIn(remove),
  counts,
  restore: mustBeSignedIn(restore),
};
