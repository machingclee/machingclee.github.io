const n=`---
title: "Use ULID in PostgreSQL"
date: 2024-02-26
id: blog0240
tag:  sql, prisma
intro: "We record how to use ULID instead of UUID in PostgreSQL"
toc: true
---

<style>
  img {
    max-width: 660px
  }
</style>

### SQL Funcitons

#### generate_ulid


- [Source](https://github.com/geckoboard/pgulid/blob/master/pgulid.sql)

- Example Result of this Function: \`01HQGKW8ZK4FVKT8N5WYEQNB7F\`

- \`\`\`sql
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  CREATE OR REPLACE FUNCTION generate_ulid()
  RETURNS TEXT
  AS $$
  DECLARE
    -- Crockford's Base32
    encoding   BYTEA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    timestamp  BYTEA = E'\\\\000\\\\000\\\\000\\\\000\\\\000\\\\000';
    output     TEXT = '';

    unix_time  BIGINT;
    ulid       BYTEA;
  BEGIN
    -- 6 timestamp bytes
    unix_time = (EXTRACT(EPOCH FROM CLOCK_TIMESTAMP()) * 1000)::BIGINT;
    timestamp = SET_BYTE(timestamp, 0, (unix_time >> 40)::BIT(8)::INTEGER);
    timestamp = SET_BYTE(timestamp, 1, (unix_time >> 32)::BIT(8)::INTEGER);
    timestamp = SET_BYTE(timestamp, 2, (unix_time >> 24)::BIT(8)::INTEGER);
    timestamp = SET_BYTE(timestamp, 3, (unix_time >> 16)::BIT(8)::INTEGER);
    timestamp = SET_BYTE(timestamp, 4, (unix_time >> 8)::BIT(8)::INTEGER);
    timestamp = SET_BYTE(timestamp, 5, unix_time::BIT(8)::INTEGER);

    -- 10 entropy bytes
    ulid = timestamp || gen_random_bytes(10);

    -- Encode the timestamp
    output = output || CHR(GET_BYTE(encoding, (GET_BYTE(ulid, 0) & 224) >> 5));
    output = output || CHR(GET_BYTE(encoding, (GET_BYTE(ulid, 0) & 31)));
    output = output || CHR(GET_BYTE(encoding, (GET_BYTE(ulid, 1) & 248) >> 3));
    output = output || CHR(GET_BYTE(encoding, ((GET_BYTE(ulid, 1) & 7) << 2) | ((GET_BYTE(ulid, 2) & 192) >> 6)));
    output = output || CHR(GET_BYTE(encoding, (GET_BYTE(ulid, 2) & 62) >> 1));
    output = output || CHR(GET_BYTE(encoding, ((GET_BYTE(ulid, 2) & 1) << 4) | ((GET_BYTE(ulid, 3) & 240) >> 4)));
    output = output || CHR(GET_BYTE(encoding, ((GET_BYTE(ulid, 3) & 15) << 1) | ((GET_BYTE(ulid, 4) & 128) >> 7)));
    output = output || CHR(GET_BYTE(encoding, (GET_BYTE(ulid, 4) & 124) >> 2));
    output = output || CHR(GET_BYTE(encoding, ((GET_BYTE(ulid, 4) & 3) << 3) | ((GET_BYTE(ulid, 5) & 224) >> 5)));
    output = output || CHR(GET_BYTE(encoding, (GET_BYTE(ulid, 5) & 31)));

    -- Encode the entropy
    output = output || CHR(GET_BYTE(encoding, (GET_BYTE(ulid, 6) & 248) >> 3));
    output = output || CHR(GET_BYTE(encoding, ((GET_BYTE(ulid, 6) & 7) << 2) | ((GET_BYTE(ulid, 7) & 192) >> 6)));
    output = output || CHR(GET_BYTE(encoding, (GET_BYTE(ulid, 7) & 62) >> 1));
    output = output || CHR(GET_BYTE(encoding, ((GET_BYTE(ulid, 7) & 1) << 4) | ((GET_BYTE(ulid, 8) & 240) >> 4)));
    output = output || CHR(GET_BYTE(encoding, ((GET_BYTE(ulid, 8) & 15) << 1) | ((GET_BYTE(ulid, 9) & 128) >> 7)));
    output = output || CHR(GET_BYTE(encoding, (GET_BYTE(ulid, 9) & 124) >> 2));
    output = output || CHR(GET_BYTE(encoding, ((GET_BYTE(ulid, 9) & 3) << 3) | ((GET_BYTE(ulid, 10) & 224) >> 5)));
    output = output || CHR(GET_BYTE(encoding, (GET_BYTE(ulid, 10) & 31)));
    output = output || CHR(GET_BYTE(encoding, (GET_BYTE(ulid, 11) & 248) >> 3));
    output = output || CHR(GET_BYTE(encoding, ((GET_BYTE(ulid, 11) & 7) << 2) | ((GET_BYTE(ulid, 12) & 192) >> 6)));
    output = output || CHR(GET_BYTE(encoding, (GET_BYTE(ulid, 12) & 62) >> 1));
    output = output || CHR(GET_BYTE(encoding, ((GET_BYTE(ulid, 12) & 1) << 4) | ((GET_BYTE(ulid, 13) & 240) >> 4)));
    output = output || CHR(GET_BYTE(encoding, ((GET_BYTE(ulid, 13) & 15) << 1) | ((GET_BYTE(ulid, 14) & 128) >> 7)));
    output = output || CHR(GET_BYTE(encoding, (GET_BYTE(ulid, 14) & 124) >> 2));
    output = output || CHR(GET_BYTE(encoding, ((GET_BYTE(ulid, 14) & 3) << 3) | ((GET_BYTE(ulid, 15) & 224) >> 5)));
    output = output || CHR(GET_BYTE(encoding, (GET_BYTE(ulid, 15) & 31)));

    RETURN output;
  END
  $$
  LANGUAGE plpgsql
  VOLATILE;
  \`\`\`

#### ulid_to_uuid

- [Source](https://github.com/scoville/pgsql-ulid/blob/main/ulid-to-uuid.sql)

- Next we turn \`01HQGKW8ZK4FVKT8N5WYEQNB7F\` into the standard \`UUID\` format:
  \`\`\`sql
  CREATE OR REPLACE FUNCTION parse_ulid(ulid text) RETURNS bytea AS $$
  DECLARE
    -- 16byte 
    bytes bytea = E'\\\\x00000000 00000000 00000000 00000000';
    v     char[];
    -- Allow for O(1) lookup of index values
    dec   integer[] = ARRAY[
      255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
      255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
      255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
      255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
      255, 255, 255, 255, 255, 255, 255,   0,   1,   2,
        3,   4,   5,   6,   7,   8,   9, 255, 255, 255,
      255, 255, 255, 255,  10,  11,  12,  13,  14,  15,
      16,  17,   1,  18,  19,   1,  20,  21,   0,  22,
      23,  24,  25,  26, 255,  27,  28,  29,  30,  31,
      255, 255, 255, 255, 255, 255,  10,  11,  12,  13,
      14,  15,  16,  17,   1,  18,  19,   1,  20,  21,
        0,  22,  23,  24,  25,  26, 255,  27,  28,  29,
      30,  31
    ];
  BEGIN
    IF NOT ulid ~* '^[0-7][0-9ABCDEFGHJKMNPQRSTVWXYZ]{25}$' THEN
      RAISE EXCEPTION 'Invalid ULID: %', ulid;
    END IF;

    v = regexp_split_to_array(ulid, '');

    -- 6 bytes timestamp (48 bits)
    bytes = SET_BYTE(bytes, 0, (dec[ASCII(v[1])] << 5) | dec[ASCII(v[2])]);
    bytes = SET_BYTE(bytes, 1, (dec[ASCII(v[3])] << 3) | (dec[ASCII(v[4])] >> 2));
    bytes = SET_BYTE(bytes, 2, (dec[ASCII(v[4])] << 6) | (dec[ASCII(v[5])] << 1) | (dec[ASCII(v[6])] >> 4));
    bytes = SET_BYTE(bytes, 3, (dec[ASCII(v[6])] << 4) | (dec[ASCII(v[7])] >> 1));
    bytes = SET_BYTE(bytes, 4, (dec[ASCII(v[7])] << 7) | (dec[ASCII(v[8])] << 2) | (dec[ASCII(v[9])] >> 3));
    bytes = SET_BYTE(bytes, 5, (dec[ASCII(v[9])] << 5) | dec[ASCII(v[10])]);

    -- 10 bytes of entropy (80 bits);
    bytes = SET_BYTE(bytes, 6, (dec[ASCII(v[11])] << 3) | (dec[ASCII(v[12])] >> 2));
    bytes = SET_BYTE(bytes, 7, (dec[ASCII(v[12])] << 6) | (dec[ASCII(v[13])] << 1) | (dec[ASCII(v[14])] >> 4));
    bytes = SET_BYTE(bytes, 8, (dec[ASCII(v[14])] << 4) | (dec[ASCII(v[15])] >> 1));
    bytes = SET_BYTE(bytes, 9, (dec[ASCII(v[15])] << 7) | (dec[ASCII(v[16])] << 2) | (dec[ASCII(v[17])] >> 3));
    bytes = SET_BYTE(bytes, 10, (dec[ASCII(v[17])] << 5) | dec[ASCII(v[18])]);
    bytes = SET_BYTE(bytes, 11, (dec[ASCII(v[19])] << 3) | (dec[ASCII(v[20])] >> 2));
    bytes = SET_BYTE(bytes, 12, (dec[ASCII(v[20])] << 6) | (dec[ASCII(v[21])] << 1) | (dec[ASCII(v[22])] >> 4));
    bytes = SET_BYTE(bytes, 13, (dec[ASCII(v[22])] << 4) | (dec[ASCII(v[23])] >> 1));
    bytes = SET_BYTE(bytes, 14, (dec[ASCII(v[23])] << 7) | (dec[ASCII(v[24])] << 2) | (dec[ASCII(v[25])] >> 3));
    bytes = SET_BYTE(bytes, 15, (dec[ASCII(v[25])] << 5) | dec[ASCII(v[26])]);

    RETURN bytes;
  END
  $$
  LANGUAGE plpgsql
  IMMUTABLE;
  \`\`\`
  \`\`\`sql
  CREATE OR REPLACE FUNCTION ulid_to_uuid(ulid text) RETURNS uuid AS $$
  BEGIN
    RETURN encode(parse_ulid(ulid), 'hex')::uuid;
  END
  $$
  LANGUAGE plpgsql
  IMMUTABLE;
  \`\`\`

#### ulid_as_uuid

Finally we combine all of the above:

\`\`\`sql
CREATE OR REPLACE FUNCTION ulid_as_uuid() RETURNS uuid AS $$
BEGIN
	 RETURN ulid_to_uuid(generate_ulid());
END
$$
LANGUAGE plpgsql;
\`\`\`


### Example

Now by 
\`\`\`sql
SELECT ulid_as_uuid();
\`\`\`
we get 
\`\`\`sql
018de143-60a9-7476-6bdc-c4736b7f19e8
\`\`\`

### References 

- [SQL Function to get ULID](https://github.com/geckoboard/pgulid/blob/master/pgulid.sql)

- [Parse ULID to UUID](https://github.com/scoville/pgsql-ulid/blob/main/ulid-to-uuid.sql)`;export{n as default};
