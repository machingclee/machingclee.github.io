const e=`---
title: "Auto-Incremented Id for Mongo Collection"
date: 2023-09-24
id: blog0184
tag: mongo
intro: "We create a special collection and a hook to the save method of a collection to obtain an auto-incremented id field!"
toc: true
---

### Create a Counter Collection to Store all Serialized id Fields

We start from creating a \`Counter\` collection:

\`\`\`js
import mongoose, { Document, InferSchemaType, Schema } from "mongoose";

const counterSchema = new Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});
export const CounterModel = mongoose.model('Counter', counterSchema);

export async function getNextSequence(name: string): Promise<number> {
    const result = await CounterModel.findOneAndUpdate({
        _id: name
    }, {
        $inc: { seq: 1 }
    }, {
        upsert: true
    });
    if (!result) {
        throw new Error("Error in counter model");
    }
    const seq = result.seq;
    return seq
}
\`\`\`

- In \`Counter\` collection each document will have \`_id\` as the desired name (like \`userId\`).
- On \`save()\` a new target document, we will query for \`Counter\` collection, add the \`seq\` value by 1, and then inject that \`seq\` value into our target document.

### Hook to \`save()\` Method of a Collection

We create a hook to \`save()\` method and perform the \`seq\` injection by:

\`\`\`js
import mongoose, { InferSchemaType, Schema } from "mongoose";
import { getNextSequence } from "./Counter";

export const userSchema = new Schema(
    {
        id: { type: Number, required: true, unique: true, min: 1 },
        name: { type: String, required: true, index: true },
        email: { type: String, required: true },
        passwordHash: { type: String, required: true },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false,
    }
);

userSchema.pre("save", function (next) {
    const doc = this;
    getNextSequence("userId").then(nextId => {
        doc.id = nextId;
        next();
    }).catch((err) => {
        console.log(\`getNextSequence failed: \${err}\`);
    })
})

export type User = InferSchemaType<typeof userSchema>;
export const UserModel = mongoose.model('User', userSchema);
\`\`\`
`;export{e as default};
