const { MongoClient } = require('mongodb');



class MongoDBHelper {
    constructor(uri, dbName, collectionName) {
        this.uri = uri;
        this.dbName = dbName;
        this.collectionName = collectionName;
        this.client = new MongoClient(this.uri, { useNewUrlParser: true, useUnifiedTopology: true });
    }

    async connect() {
        try {
            await this.client.connect();
            console.log('Connected to MongoDB');
            this.database = this.client.db(this.dbName);
            this.collection = this.database.collection(this.collectionName);
        } catch (error) {
            console.error('Error connecting to MongoDB:', error);
        }
    }

    async insertOne(document) {
        try {
            await this.collection.insertOne(document);
            console.log('Document inserted into MongoDB:', document);
        } catch (error) {
            console.error('Error inserting document into MongoDB:', error);
        }
    }

    async close() {
        await this.client.close();
        console.log('MongoDB connection closed');
    }
}

module.exports = MongoDBHelper;
