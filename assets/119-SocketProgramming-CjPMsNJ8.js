const n=`---
title: Socket Programming Fundamentals by winsock
date: 2023-01-10
id: blog0119
tag: C++
intro: "We create a simple TCP Server via \`winsock\`."
---

### Utils - Mimic the Split Functions for Text as in JS and Python

**Header.**

\`\`\`cpp
#pragma once

#include <string>
#include <vector>

std::vector<std::string> split(std::string text, std::string space_delimiter = " ");
\`\`\`

**Implementation.**

\`\`\`cpp
#include "utils/split.h"

std::vector<std::string> split(std::string text, std::string space_delimiter) {
    bool hasNext = false;
    std::vector<std::string> words{};
    do {
        size_t nextPos = text.find(space_delimiter);
        hasNext = (nextPos != std::string::npos);
        words.push_back(text.substr(0, nextPos));
        text.erase(0, nextPos + space_delimiter.length());
    } while (hasNext);
    return words;
}
\`\`\`

### TcpListener

**Header.**

\`\`\`cpp
#pragma once
#include <WS2tcpip.h>
#include <iostream>
#include <sstream>
using namespace std;

class TcpListener {
public:
    TcpListener(const char* ipAddress, int port);
    int init(); // initialize the listener
    int run();  // run the listener

protected:
    virtual void onClientConnected(int clientSocket) = 0;                              // handler for client connection
    virtual void onClientDisconnected(int clientSocket) = 0;                           // handler for client disconnection
    virtual void onMessageReceived(int currSock, char* buffer, int bytesReceived) = 0; // handler for received message
    void sendToClient(int clientSocket, const char* msg, int length);                  // send message to client
    void broadcastToClients(int sendingClient, const char* msg, int length);

private:
    const char* _ipAddress; // ip of the web server
    int _port;              // port for the web service
    int _socket;            // internal socket fd
    fd_set _fd_set;         // master fd set
};
\`\`\`

**Implementation.**

\`\`\`cpp
#include "TcpListener.h"

TcpListener::TcpListener(const char* ipAddress, int port)
    : _ipAddress(ipAddress), _port(port){};

int TcpListener::init() {
    // initialize winsock
    WSADATA wsData;
    WORD ver = MAKEWORD(2, 2);

    int wsOk = WSAStartup(ver, &wsData);
    if (wsOk != 0) {
        cerr << "Can't Initialize winsock! Quitting" << endl;
        return wsOk;
    }

    // create a socket
    _socket = socket(AF_INET, SOCK_STREAM, 0);

    if (_socket == INVALID_SOCKET) {
        cerr << "can't create a socket, quitting" << endl;
        return WSAGetLastError();
    }

    // bind the ip address and port to a socket
    sockaddr_in hint;
    hint.sin_family = AF_INET;
    hint.sin_port = htons(_port);
    // hint.sin_addr.S_un.S_addr = INADDR_ANY;
    // hint.sin_addr.S_un.S_addr = inet_addr(_ipAddress);
    inet_pton(AF_INET, _ipAddress, &hint.sin_addr);
    int bindResult = bind(_socket, (sockaddr*)&hint, sizeof(hint));
    if (bindResult == SOCKET_ERROR) {
        return WSAGetLastError();
    }

    // tell winsock the socket is for listening
    int listeningResult = listen(_socket, SOMAXCONN);
    if (listeningResult == SOCKET_ERROR) {
        return WSAGetLastError();
    }

    FD_ZERO(&_fd_set);
    FD_SET(_socket, &_fd_set);

    return 0;
};
int TcpListener::run() {
    while (true) {
        fd_set copy = _fd_set;
        int socketCount = select(0, &copy, nullptr, nullptr, nullptr);
        for (int i = 0; i < socketCount; i++) {
            SOCKET currSock = copy.fd_array[i];
            if (currSock == _socket) {
                // accept a new connection

                // sockaddr_in client;
                // int clientSize = sizeof(client);
                // SOCKET clientSocket = accept(listening, (sockaddr *)&client, &clientSize);

                SOCKET clientSocket = accept(_socket, nullptr, nullptr);

                // add the new connection the list of connected clients
                // socket <-> fd <-> u_int
                FD_SET(clientSocket, &_fd_set);
                onClientConnected(clientSocket);
            } else {
                char buffer[4096];
                ZeroMemory(buffer, 4096);

                //  receive message
                int bytesReceived = recv(currSock, buffer, 4096, 0);
                if (bytesReceived <= 0) {
                    // drop the client
                    // TODO: client disconnected;
                    onClientDisconnected(currSock);
                    closesocket(currSock);
                    FD_CLR(currSock, &_fd_set);

                } else {
                    // send message toimage.png other clients, excluding the listening socket
                    onMessageReceived(currSock, buffer, bytesReceived);
                    bool isNullSentence = buffer[0] == 13 && buffer[1] == 10;
                    if (!isNullSentence) {
                        for (int i = 0; i < _fd_set.fd_count; i++) {
                            SOCKET outSock = _fd_set.fd_array[i];

                            if (outSock != _socket && outSock != currSock) {
                                // ostringstream ss;
                                // ss << "SOCKET #" << sock << ": " << buffer << "\\r\\n";
                                // string strOut = ss.str();
                                // send(outSock, strOut.c_str(), strOut.size() + 1, 0);
                            }
                        }
                    }
                }
            }
        }
    }

    //  remove the listening socket from the master fd set and close it
    // to prevent anyone else trying to connect.

    FD_CLR(_socket, &_fd_set);
    closesocket(_socket);

    while (_fd_set.fd_count > 0) {
        SOCKET sock = _fd_set.fd_array[0];
        FD_CLR(sock, &_fd_set);
        closesocket(sock);
    }

    WSACleanup();
    return 0;
};

void TcpListener::sendToClient(int clientSocket, const char* msg, int length) {
    send(clientSocket, msg, length, 0);
}

void TcpListener::broadcastToClients(int sendingClientToExlcude, const char* msg, int length) {
    for (int i = 0; i < _fd_set.fd_count; i++) {
        int outSock = _fd_set.fd_array[i];
        if (sendingClientToExlcude != _socket && sendingClientToExlcude != outSock) {
            sendToClient(outSock, msg, length);
        }
    }
}
\`\`\`

### MultiClientServer

**Header.**

\`\`\`cpp
#pragma once
#include "TcpListener.h"

class MultiClientChat : public TcpListener {
public:
    MultiClientChat(const char* ipAddress, int port) : TcpListener(ipAddress, port){};

protected:
    void onClientConnected(int clientSocket);
    void onClientDisconnected(int clientSocket);
    void onMessageReceived(int currSock, char* buffer, int bytesReceived);
};
\`\`\`

**Implementation.**

\`\`\`cpp
#include "MultiClientChat.h"

void MultiClientChat::onClientConnected(int clientSocket) {
    // send a welcome message to the connected client
    std::string welcomeMsg = "Welcome to the chat server";
    sendToClient(clientSocket, welcomeMsg.c_str(), welcomeMsg.size() + 1);
};

void MultiClientChat::onClientDisconnected(int clientSocket) {
    ostringstream ss;
    ss << "Client #" << clientSocket << " has disconnected";
    std::string msg = ss.str();
    broadcastToClients(clientSocket, msg.c_str(), msg.size() + 1);
};

void MultiClientChat::onMessageReceived(int currSock, char* buffer, int bytesReceived) {
    broadcastToClients(currSock, buffer, bytesReceived);
}
\`\`\`

### WebServer

**Header.**

\`\`\`cpp
#pragma once
#include "TcpListener.h"

class WebServer : public TcpListener {
public:
    WebServer(const char* ipAddress, int port) : TcpListener(ipAddress, port){};

protected:
    void onClientConnected(int clientSocket);
    void onClientDisconnected(int clientSocket);
    void onMessageReceived(int currSock, char* buffer, int bytesReceived);
};
\`\`\`

**Implementation.**

\`\`\`cpp
#include "WebServer.h"
#include "utils/split.h"
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

void WebServer::onClientConnected(int clientSocket){

};

void WebServer::onClientDisconnected(int clientSocket){

};

void WebServer::onMessageReceived(int currSock, char* buffer, int bytesReceived) {
    // GET /index.html HTTP/1.1
    // parse out the doucment requested
    // open the document in local file system
    // write the document back to the client
    std::string clientMessage{buffer};
    // std::istringstream iss(buffer);
    std::vector<std::string> parsed = split(clientMessage, " ");

    std::string method = parsed[0];
    std::string targetHtml = parsed[1];

    if (method == "GET") {
        std::string fileRootLocation = "C:\\\\Users\\\\user\\\\Repos\\\\Javascript\\\\2021-02-18-machingclee.github.io";
        int htmlPos = targetHtml.find(".html");

        // remove .html in case it exists
        if (htmlPos != std::string::npos) {
            targetHtml.erase(htmlPos, htmlPos + 5);
        }

        // naive routing
        targetHtml.erase(0, 1);
        std::string filePath = fileRootLocation + "\\\\" + (targetHtml == "" ? "" : (targetHtml + "\\\\")) + "index.html";
        std::ifstream file{filePath};
        std::string content{"404 Not Found"};

        if (file.good()) {
            std::ostringstream ss;
            ss << file.rdbuf();
            content = ss.str();
        }
        file.close();

        std::ostringstream ss;
        ss << "HTTP/1.1 200 OK\\r\\n"
           << "Cache-Control: no-cache, private\\r\\n"
           << "Content-Type: text/html\\r\\n"
           << "Content-Length: "
           << content.size()
           << "\\r\\n"
           << "\\r\\n"
           << content;

        std::string res = ss.str();
        sendToClient(currSock, res.c_str(), res.size() + 1);
    }
};
\`\`\`
`;export{n as default};
