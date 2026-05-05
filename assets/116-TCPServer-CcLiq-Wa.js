const n=`---
title: TCP Server Fundamental
date: 2022-12-12
id: blog0116
tag: C++
intro: A simple TCP server that receive and hold a connection.
---

### Repo

The C++ project we made will be a CMake project.

- https://github.com/machingclee/2022-12-12-CMake-TCP-Server-Study

### Install Boost Asio

- We have a static library called \`MOYFNetworking\`, we just need to include the boost header once inside our \`MOYFNetworking/common.h\`.
- We will be able to use boost library once we include this \`common.h\` file.
- Inside the library \`MOYFNetworking\`, we need to define the environment variable \`BOOST_ROOT\` which points to the \`include\` directory of the boost library.

\`\`\`text
set(BOOST_ROOT "C:\\\\Users\\\\user\\\\Repos\\\\C++Libraries\\\\boost_1_80_0")
\`\`\`

as is done in [\`CMakeLists.txt\`](https://github.com/machingclee/2022-12-12-CMake-TCP-Server-Study/blob/main/MUDOnYourFace/MOYFNetworking/CMakeLists.txt).

### Networking

#### common.h

We include all common header files and create useful utility functions inside this file:

\`\`\`cpp
Networking/include/Networking/common.h

#pragma once

#include "boost/asio.hpp"
#include <iostream>
#include <iterator>
#include <vector>


namespace MOYF {
    using tcp = boost::asio::ip::tcp;
}
enum class MyEnum {
    One,
    Two,
    Three
};

template<class F, class First, class... Rest>
void do_for(F f, First first, Rest... rest) {
    f(first);
    do_for(f, rest...);
}

template<class F>

void do_for(F f) {
    std::cout << "\\n";
}

template<class... Args>
void print(Args... args) {
    do_for([](auto &arg) {
        std::cout << arg;
    }, args...);
}
\`\`\`

#### TCPConnection

\`\`\`cpp
// tcp_connection.h

#pragma once

#include "MOYFNetworking/common.h"
#include <memory>

namespace MOYF {

    class TCPConnection : public std::enable_shared_from_this<TCPConnection> {
    public:
        using Pointer = std::shared_ptr<TCPConnection>;

        static Pointer Create(boost::asio::io_context &ioContext) {
            return Pointer(new TCPConnection(ioContext));
        }

        tcp::socket &Socket() {
            return _socket;
        }

        void Start();

    private:
        explicit TCPConnection(boost::asio::io_context &ioContext);


    private:
        tcp::socket _socket;
        std::string _message{"Hello, client!"};
    };
}
\`\`\`

\`\`\`cpp
// tcp_connection.cpp

#include "MOYFNetworking/tcp_connection.h"
#include <memory>

namespace MOYF {
    TCPConnection::TCPConnection(boost::asio::io_context &ioContext) :
            _socket(ioContext) {

    }

    void TCPConnection::Start() {
        auto strongThis = shared_from_this();
        auto dataToSend = boost::asio::buffer(_message);
        boost::asio::async_write(
                _socket,
                dataToSend,
                [strongThis](const boost::system::error_code &error, size_t bytesTransferred) {
                    if (error) {
                        print("Failed to send message");
                    } else {
                        print("Sent ", bytesTransferred, " bytes of data.");
                    }
                }
        );

        boost::asio::streambuf buffer;
        _socket.async_receive(
                buffer.prepare(512),
                [this](const boost::system::error_code &error, size_t bytesTransferred) {
                    if (!error) {
                        print("Client Disconnected Properly.");
                    } else {
                        print("Client Disconnected in Bad Way.");
                    }
                });
    }
}
\`\`\`

#### TCPServer

\`\`\`cpp
// tcp_server.h

#pragma once

#include "MOYFNetworking/common.h"
#include "MOYFNetworking/tcp_connection.h"


namespace MOYF {
    enum class IPV {
        V4,
        V6
    };

    class TCPServer {
    public:
        TCPServer(IPV ip_version, int port);

        int Run();

    private:
        void StartAccept();

    private:
        IPV _ipVersion;
        int _port;
        boost::asio::io_context _ioContext{};
        boost::asio::ip::tcp::acceptor _acceptor;

        std::vector<TCPConnection::Pointer> _connections{};
    };
}
\`\`\`

\`\`\`cpp
// tcp_server.cpp

#include "MOYFNetworking/tcp_server.h"
#include "MOYFNetworking/tcp_connection.h"

namespace MOYF {
    using tcp = boost::asio::ip::tcp;

    TCPServer::TCPServer(IPV ip_version, int port)
            : _ipVersion(ip_version), _port(port),
              _acceptor(tcp::acceptor(
                      _ioContext,
                      tcp::endpoint(ip_version == IPV::V4 ? tcp::v4() : tcp::v6(), _port)
              )) {}

    int TCPServer::Run() {
        try {
            StartAccept();
            _ioContext.run();
        } catch (std::exception &e) {
            print(e.what());
            return -1;
        }
        return 0;
    }

    void TCPServer::StartAccept() {
        // this connection will be destroyed once it is out of scope
        auto connection = TCPConnection::Create(_ioContext);
        _connections.push_back(connection);
        _acceptor.async_accept(
                connection->Socket(),
                [this, connection](const boost::system::error_code ec) {
                    // capture connection by value;
                    if (!ec) {
                        connection->Start();
                    } else {
                        print(ec.what());
                    }
                    StartAccept();
                });

    }
}
\`\`\`

### NetClient

This is just a single \`cpp\` file which creates a binary file that pings our server:

\`\`\`cpp
// main.cpp

#include <iostream>
#include "MOYFNetworking/common.h"
#include <array>

using tcp = boost::asio::ip::tcp;

int main(int argc, char *argv[]) {
    try {
        boost::asio::io_context ioContext;

				tcp::socket socket{ioContext};
        tcp::resolver resolver{ioContext};

        auto endpoints = resolver.resolve("127.0.0.1", "8080");

        boost::asio::connect(socket, endpoints);

        while (true) {
            std::array<char, 128> receivedDataBuffer{};
            boost::system::error_code error;

            size_t len = socket.read_some(boost::asio::buffer(receivedDataBuffer), error);

            if (error == boost::asio::error::eof) {
                break;
            } else if (error) {
                throw boost::system::system_error(error);
            };

            std::cout.write(receivedDataBuffer.data(), len);
        }
    } catch (std::exception &e) {
        print(e.what());
    }
}
\`\`\`

Recall that \`main\` is the only special function that needs not to return anything though the return type is \`int\`.

### NetServer

\`\`\`cpp
// main.cpp

#include "boost/asio.hpp"
#include "MOYFNetworking/tcp_server.h"

int port_number = 8080;

int main() {
    MOYF::TCPServer server{MOYF::IPV::V4, port_number};
    server.Run();
}
\`\`\`
`;export{n as default};
