require('dotenv').config();
const { MongoClient } = require('mongodb');

const url = process.env.DB_URL || 'mongodb://localhost/issuetracker';
function testWithCallbacks(callback) {
  const client = new MongoClient(url, { useNewUrlParser: true });

  client.connect((connErr) => {
    if (connErr) {
      callback(connErr);
      return;
    }
    const db = client.db();
    console.log('MOngoDb URl : ', url);

    const collection = db.collection('employees');
    const employee = { id: 3, name: 'Raj', age: 34 };
    collection.insertOne(employee, (insertErr, result) => {
      if (insertErr) {
        client.close();
        callback(insertErr);
        return;
      }
      console.log('Result of insert : ', result.insertedId);
      collection.find({ _id: result.insertedId })
        .toArray((findErr, docs) => {
          if (findErr) {
            client.close();
            callback(findErr);
            // eslint-disable-next-line no-useless-return
            return;
          }
          console.log('Result of find:\n', docs);
          client.close();
          callback();
        });
    });
  });
}

async function testWithAsync() {
  console.log('\n--- testWithAsync ---');
  const client = new MongoClient(url, { useNewUrlParser: true });
  try {
    await client.connect();
    console.log('MOngoDb URl : ', url);

    const db = client.db();
    const collection = db.collection('employees');
    const employee = { id: 2, name: 'Rajendra', age: 38 };
    const result = await collection.insertOne(employee);
    console.log('Result of insert:\n', result.insertedId);

    const docs = await collection.find({ _id: result.insertedId })
      .toArray();
    console.log('Result of find:\n', docs);
  } catch (err) {
    console.log(err);
  } finally {
    client.close();
  }
}

testWithCallbacks((err) => {
  if (err) {
    console.log(err);
  }
  testWithAsync();
});
