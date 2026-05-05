const n=`---
title: "Network Byte Order: \`ntohl()\` and \`ntohs()\`"
date: 2026-02-13
id: blog0455
tag: C
toc: true
intro: "Discuss Endianness"
---

<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
</style>
### The Problem: Different Byte Orders (Endianness)

#### What is Endianness?

***Endianness*** refers to the order in which bytes are stored in memory for multi-byte data types.

Consider the 32-bit integer: \`0x12345678\`

**Big-Endian** (Most significant byte first):
\`\`\`text
Address:  0x00   0x01   0x02   0x03
Value:    0x12   0x34   0x56   0x78
          ↑ Most significant byte
\`\`\`

**Little-Endian** (Least significant byte first):
\`\`\`text
Address:  0x00   0x01   0x02   0x03
Value:    0x78   0x56   0x34   0x12
          ↑ Least significant byte
\`\`\`

#### Why This Matters

Different CPU architectures use different byte orders:

| Architecture | Byte Order |
|--------------|------------|
| x86/x64 (Intel, AMD) | Little-Endian |
| ARM (varies) | Bi-endian (usually Little) |
| PowerPC | Big-Endian |
| Network Protocols | **Big-Endian (Network Byte Order)** |

**The problem**: If we write data on one system and read it on another with different endianness, the values will be **completely wrong**.

#### Example of the Problem

We write the integer \`305,419,896\` (\`0x12345678\`) on an x86 machine to a file:

\`\`\`c
// x86 (little-endian) writes:
File bytes: 78 56 34 12

// PowerPC (big-endian) reads same file:
Reads as: 0x78563412 = 2,018,915,346  WRONG!
\`\`\`

### The Solution: Network Byte Order

#### Standard Convention

To ensure compatibility across different systems, protocols and file formats define a **standard byte order**:

- ***Network Byte Order*** = ***Big-Endian***
- All network protocols (TCP/IP, UDP, etc.) use big-endian
- Many binary file formats also use big-endian for consistency

#### Conversion Functions

C provides functions to convert between **host byte order** (our machine) and **network byte order** (big-endian standard):

\`\`\`c
#include <arpa/inet.h>  // On Unix/Linux/macOS
#include <winsock2.h>   // On Windows
\`\`\`

### The Four Functions

#### \`htons()\` - Host to Network Short
- Converts **16-bit** value from host to network byte order
- Use when **writing** 16-bit values to network/file

\`\`\`c
uint16_t host_value = 0x1234;
uint16_t network_value = htons(host_value);
// Now safe to send over network or write to file
\`\`\`

#### \`htonl()\` - Host to Network Long
- Converts **32-bit** value from host to network byte order
- Use when **writing** 32-bit values to network/file

\`\`\`c
uint32_t host_value = 0x12345678;
uint32_t network_value = htonl(host_value);
// Now safe to send over network or write to file
\`\`\`

#### \`ntohs()\` - Network to Host Short
- Converts **16-bit** value from network to host byte order
- Use when **reading** 16-bit values from network/file

\`\`\`c
uint16_t network_value = /* read from file */;
uint16_t host_value = ntohs(network_value);
// Now safe to use on our system
\`\`\`

#### \`ntohl()\` - Network to Host Long
- Converts **32-bit** value from network to host byte order
- Use when **reading** 32-bit values from network/file

\`\`\`c
uint32_t network_value = /* read from file */;
uint32_t host_value = ntohl(network_value);
// Now safe to use on our system
\`\`\`

### Function Name Breakdown

\`\`\`text
ntohs
│││└─ s = short (16-bit)
│││
││└── h = host byte order
││
│└─── to = convert to
│
└──── n = network byte order

Translates to: "Network TO Host Short"
\`\`\`

Similarly:
- \`ntohl\`: **N**etwork **TO** **H**ost **L**ong (32-bit)
- \`htons\`: **H**ost **TO** **N**etwork **S**hort (16-bit)
- \`htonl\`: **H**ost **TO** **N**etwork **L**ong (32-bit)

### When to Use These Functions

#### Always Use When:

1. **Writing/reading binary data to files** that might be used on different architectures

2. **Sending/receiving data over networks**
3. **Implementing binary protocols** (like our database file format)
4. **Working with portable binary formats**

#### Don't Need When:

1. Data stays within same program (never written to disk/network)

2. Using text-based formats (JSON, XML, CSV)
3. Using standard serialization libraries that handle it

### Complete Example: Our Database Header

\`\`\`c
struct db_header_t {
    unsigned int magic;      // 32-bit
    unsigned short version;  // 16-bit
    unsigned short count;    // 16-bit
    unsigned int filesize;   // 32-bit
};
\`\`\`

#### Writing to File (Host → Network)

\`\`\`c
int write_db_header(int fd, struct db_header_t* header) {
    struct db_header_t network_header;
    
    // Convert to network byte order before writing
    network_header.magic    = htonl(header->magic);
    network_header.version  = htons(header->version);
    network_header.count    = htons(header->count);
    network_header.filesize = htonl(header->filesize);
    
    write(fd, &network_header, sizeof(network_header));
    return 0;
}
\`\`\`

#### Reading from File (Network → Host)

\`\`\`c
int read_db_header(int fd, struct db_header_t* header) {
    struct db_header_t network_header;
    
    read(fd, &network_header, sizeof(network_header));
    
    // Convert from network byte order after reading
    header->magic    = ntohl(network_header.magic);
    header->version  = ntohs(network_header.version);
    header->count    = ntohs(network_header.count);
    header->filesize = ntohl(network_header.filesize);
    
    return 0;
}
\`\`\`

### Size Guide: Which Function to Use?

| Data Type | Size | Function (Write) | Function (Read) |
|-----------|------|------------------|-----------------|
| \`short\`, \`uint16_t\` | 16-bit | \`htons()\` | \`ntohs()\` |
| \`int\`, \`uint32_t\` | 32-bit | \`htonl()\` | \`ntohl()\` |
| \`long long\`, \`uint64_t\` | 64-bit | Manual or \`htobe64()\` | Manual or \`be64toh()\` |
| \`char\`, \`uint8_t\` | 8-bit | **None needed** | **None needed** |

**Note**: For 64-bit integers, some systems provide \`htobe64()\` and \`be64toh()\`, but they're not as universally available as the 16/32-bit versions.

### What Happens on Big-Endian Systems?

On big-endian systems, these functions do **nothing** (they're typically macros that expand to the identity):

\`\`\`c
// On big-endian machine:
#define ntohl(x) (x)
#define ntohs(x) (x)

// On little-endian machine:
#define ntohl(x) __builtin_bswap32(x)  // Actually swaps bytes
#define ntohs(x) __builtin_bswap16(x)
\`\`\`

This means:
- **No performance penalty** on big-endian systems
- **Automatic conversion** on little-endian systems
- **Our code works everywhere** regardless of architecture

### Real-World Example: IP Addresses

IP addresses in network programming must use network byte order:

\`\`\`c
struct sockaddr_in server;
server.sin_family = AF_INET;
server.sin_port = htons(8080);  // Convert port number!
server.sin_addr.s_addr = htonl(INADDR_ANY);
\`\`\`

If we forget \`htons(8080)\`:
- On little-endian: tries to bind to port 20992 instead!
- On big-endian: works correctly, but not portable

### Common Mistakes


#### Forgetting to Convert

##### Problem
\`\`\`c
header->version = 1;
write(fd, &header->version, sizeof(header->version));  // Wrong!
\`\`\`

##### Correct
\`\`\`c
uint16_t network_version = htons(header->version);
write(fd, &network_version, sizeof(network_version));
\`\`\`

#### Wrong Function
##### Problem
\`\`\`c
unsigned short port = 8080;
uint32_t network_port = htonl(port);  // Wrong! Should use htons()
\`\`\`

##### Correct
\`\`\`c
unsigned short port = 8080;
uint16_t network_port = htons(port);
\`\`\`

####  Converting Text Data
##### Problem
\`\`\`c
char name[256];
strcpy(name, "Alice");
// DON'T convert strings - they're byte arrays, not multi-byte integers!
\`\`\`

### Testing for Endianness

We can detect our system's byte order by:

\`\`\`c
#include <stdio.h>

int main() {
    unsigned int x = 1;
    char *c = (char*)&x;
    
    if (*c) {
        printf("Little-endian\\n");
    } else {
        printf("Big-endian\\n");
    }
    return 0;
}
\`\`\`

### Summary

#### The Rule of Thumb

**Always use byte order conversion functions when:**
- Data crosses machine boundaries (network, files, IPC)
- We want portable binary formats
- Working with multi-byte integers (16-bit, 32-bit, etc.)

**Key Points:**
1. **Network byte order = Big-endian**
2. **Host byte order = Our CPU's native order**
3. **Convert when writing**: Use \`htons()\` / \`htonl()\`
4. **Convert when reading**: Use \`ntohs()\` / \`ntohl()\`
5. **Choose by size**: 16-bit → \`s\` functions, 32-bit → \`l\` functions
6. **No penalty**: Functions are no-ops on big-endian systems

#### Quick Reference Card

\`\`\`c
// Writing to network/file:
uint16_t net_val = htons(host_val_16bit);
uint32_t net_val = htonl(host_val_32bit);

// Reading from network/file:
uint16_t host_val = ntohs(net_val_16bit);
uint32_t host_val = ntohl(net_val_32bit);
\`\`\`

By consistently using these functions, our code will work correctly on **any architecture**, ensuring data portability and compatibility across different systems.

### Understanding Pack and Unpack

#### What Does "Packing" and "Unpacking" Mean?

***Packing*** and ***unpacking*** are terms commonly used to describe the byte order conversion process:

- ***Packing*** = Converting data from host byte order to network byte order (for storage/transmission)
- ***Unpacking*** = Converting data from network byte order to host byte order (for use)

#### The Process

**When data is in a file (packed):**
\`\`\`text
File bytes (big-endian): 0x12 0x34 0x56 0x78
\`\`\`
This is the "packed" format - standardized for storage/transmission.

**After reading into memory (still packed):**
\`\`\`c
read(fd, header, sizeof(struct db_header_t));
// header->magic contains raw bytes: 0x12 0x34 0x56 0x78
// But on x86 (little-endian), this is interpreted backwards!
\`\`\`

**Unpacking (converting to host byte order):**
\`\`\`c
header->magic = ntohl(header->magic);
// Now the bytes are rearranged to match our CPU's native order
// x86 sees: 0x78 0x56 0x34 0x12 (little-endian)
// Result: both formats represent the same NUMBER
\`\`\`

#### Pack vs Unpack in Practice

**Pack (before writing):**
\`\`\`c
void output_file(int fd, struct db_header_t* header) {
    // Pack: convert host → network byte order
    header->magic    = htonl(header->magic);
    header->version  = htons(header->version);
    header->count    = htons(header->count);
    header->filesize = htonl(header->filesize);
    
    write(fd, header, sizeof(*header));  // Write packed format
}
\`\`\`

**Unpack (after reading):**
\`\`\`c
int validate_db_header(int fd, struct db_header_t* header) {
    read(fd, header, sizeof(*header));  // Read packed format
    
    // Unpack: convert network → host byte order
    header->magic    = ntohl(header->magic);
    header->version  = ntohs(header->version);
    header->count    = ntohs(header->count);
    header->filesize = ntohl(header->filesize);
    
    // Now we can use the values!
    if (header->magic != EXPECTED_MAGIC) {
        // validation...
    }
}
\`\`\`

#### Why the Terminology?

The "pack/unpack" terminology comes from the idea that:
- ***Packed*** = data compressed into a standard format for storage/transmission (like packing a suitcase for travel)
- ***Unpacked*** = data expanded/converted into a format our system can directly use (like unpacking the suitcase at our destination)

#### Visual Workflow

\`\`\`text
┌─────────────┐
│  Host Data  │ Our program uses this
│  (unpacked) │ Values in native CPU format
└──────┬──────┘
       │
       │ htonl() / htons()  ← PACK
       │
       ▼
┌─────────────┐
│   Network   │ Standard format for storage
│   (packed)  │ Big-endian byte order
└──────┬──────┘
       │
       │ Write to file/network
       │ (bytes transmitted/stored)
       │ Read from file/network
       │
       ▼
┌─────────────┐
│   Network   │ Raw bytes from file
│   (packed)  │ Still big-endian
└──────┬──────┘
       │
       │ ntohl() / ntohs()  ← UNPACK
       │
       ▼
┌─────────────┐
│  Host Data  │ Ready to use
│  (unpacked) │ Values in native CPU format
└─────────────┘
\`\`\`

#### Key Takeaways

1. **Packing** happens before writing/sending data

2. **Unpacking** happens after reading/receiving data
3. Both operations ensure data is correctly interpreted regardless of CPU architecture
4. The file/network always stores the **packed** (network byte order) format
5. Our program works with **unpacked** (host byte order) data
6. Always pack before writing, always unpack after reading
`;export{n as default};
