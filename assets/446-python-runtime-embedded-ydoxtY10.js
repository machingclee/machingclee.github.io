const n=`---
title: "Embed Python Runtime into Tauri Application"
date: 2025-12-26
id: blog0446
tag: rust, tauri, python
intro: We study how to embed python runtime to enable agentic solution in a desktop application.
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




### Demonstration of the Bundled Result

<customvideo src="/assets/videos/007.mp4" width="100%"></customvideo>




### Why do we Bundle the Python Runtime into The Application?

- We can spin up a web server locally written in python and develop agentic solution to the desktop application without the need to host a webserver to provide exactly the same service. This provides much fewer latency and much higher privacy. 

- User can use their own \`API_KEY\` and \`AI_MODEL\` without us the developer to reinvent a complicated pricing plan to count how much the user has consumed. So we can concentrate on building the agentic system.

- It also pave a way for the future LLM model that can be hosted locally (or externally via additional devices). This embedding approach will provide me  a boilerplate to develop agentic software at the expense of software file size (bundling a runtime requires a lot of disk space).




### Prepare Python Runtime in Tauri Resource Folder


#### Project Structure

![](/assets/img/2025-12-28-17-42-45.png)


#### Shell Script to Install Runtime and Preintall Required Packages

##### What Packages to Include? Steps to Install Runtime

1.  From project structure we will copy a \`requirements.txt\` from \`python-backend/\` into \`src-tauri/resources/python-runtime\`. We will be downloading both python runtime and required packages into this \`python-runtime/\` directory.

    This \`resources/\` directory is the location to bundle additional resources into our Tauri appplication. 

    If our \`uv\` project has included new packages, we will need to update the \`requirements.txt\` by 

    \`\`\`bash
    uv pip compile pyproject.toml -o requirements.txt
    \`\`\`
2.  Next we check that whether we have downloaded the python runtime, if so, we will skip it. 

3. If not, we will download and unzip the python runtime via \`wget\` and \`tar -xzf\`

4. Next according to \`requirements.txt\` we install all required dependencies into \`$ARCH/lib/python3.12/site-packages\`

5. In [#install_runtime] we will further do a clean up process (line 106-147) to remove all the \`symlinks\` and *unpermitted files* when doing the bundling process into a \`dmg\` file for Mac.

    This step is to solve the following problem when I first attempt to bundle the runtime:

   ![](/assets/img/2025-12-27-00-56-38.png)  

##### Implementation of the Shell Script {#install_runtime}



We prepare an npm script 
\`\`\`json
    "install-python-runtime": "sh install_python_runtime.sh"
\`\`\`
in \`package.json\`, where \`install_python_runtime.sh\` is defined by:

\`\`\`bash-1
# install_python_runtime.sh

#!/bin/bash
# Download and install Python 3.12 standalone runtime if not present

set -e

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$SCRIPT_DIR/src-tauri/resources/python-runtime"

echo "Checking Python runtime installation..."

# Check if runtime already exists
if [ -d "$RUNTIME_DIR/aarch64" ] || [ -d "$RUNTIME_DIR/x86_64" ]; then
    echo "✓ Python runtime already installed"
    exit 0
fi

echo "Python runtime not found. Installing..."

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    ARCH="aarch64"
    PYTHON_URL="https://github.com/indygreg/python-build-standalone/releases/download/20241016/cpython-3.12.7+20241016-aarch64-apple-darwin-install_only.tar.gz"
elif [ "$ARCH" = "x86_64" ]; then
    PYTHON_URL="https://github.com/indygreg/python-build-standalone/releases/download/20241016/cpython-3.12.7+20241016-x86_64-apple-darwin-install_only.tar.gz"
else
    echo "ERROR: Unsupported architecture: $ARCH"
    exit 1
fi

echo "Downloading Python 3.12.7 for $ARCH..."
mkdir -p "$RUNTIME_DIR"
cd "$RUNTIME_DIR"

# Download with wget (with progress bar)
if ! wget --show-progress -O python.tar.gz "$PYTHON_URL"; then
    echo "ERROR: Failed to download Python runtime"
    rm -f python.tar.gz
    exit 1
fi

# Verify it's a valid tar.gz file
if ! file python.tar.gz | grep -q "gzip compressed"; then
    echo "ERROR: Downloaded file is not a valid gzip archive"
    echo "File type: $(file python.tar.gz)"
    rm -f python.tar.gz
    exit 1
fi

echo "Extracting Python runtime..."
if ! tar -xzf python.tar.gz; then
    echo "ERROR: Failed to extract Python runtime"
    rm -f python.tar.gz
    exit 1
fi

# Move extracted files to arch-specific directory
if [ -d "python" ]; then
    mv python "$ARCH"
    echo "✓ Python runtime installed to: $RUNTIME_DIR/$ARCH"
else
    echo "ERROR: Unexpected archive structure"
    exit 1
fi

# Clean up archive
rm python.tar.gz

echo "✓ Python runtime extracted"
echo ""

# Copy requirements.txt from python-backend to python-runtime
if [ -f "$SCRIPT_DIR/python-backend/requirements.txt" ]; then
    echo "Copying requirements.txt from python-backend..."
    cp "$SCRIPT_DIR/python-backend/requirements.txt" "$RUNTIME_DIR/requirements.txt"
    echo "✓ Requirements file copied"
else
    echo "WARNING: python-backend/requirements.txt not found"
fi

# Install dependencies
echo "Installing Python dependencies..."
PYTHON_BIN="$ARCH/bin/python3.12"
TARGET_DIR="$ARCH/lib/python3.12/site-packages"

if [ -f "$RUNTIME_DIR/requirements.txt" ]; then
    $PYTHON_BIN -m pip install \\
        --no-cache-dir \\
        --target "$TARGET_DIR" \\
        -r "$RUNTIME_DIR/requirements.txt"
    
    echo "✓ Dependencies installed"
else
    echo "WARNING: No requirements.txt found. Skipping dependency installation."
fi

echo ""
echo "Running post-installation cleanup..."

# Navigate to architecture directory
cd "$ARCH" || exit 1

# 1. Remove Python cache files
echo "1. Removing Python cache files..."
find . -name "*.pyc" -delete
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null

# 2. Remove macOS metadata files
echo "2. Removing macOS metadata files..."
find . -name ".DS_Store" -delete

# 3. Clear extended attributes (quarantine flags)
echo "3. Clearing extended attributes..."
xattr -rc . 2>/dev/null

# 4. Check for and resolve any symlinks
echo "4. Checking for symlinks..."
SYMLINK_COUNT=$(find . -type l | wc -l | tr -d ' ')
if [ "$SYMLINK_COUNT" -gt 0 ]; then
    echo "   Found $SYMLINK_COUNT symlinks. Resolving them..."
    find . -type l | while read link; do
        target=$(readlink "$link")
        if [ -f "$(dirname "$link")/$target" ] || [ -f "$target" ]; then
            rm "$link"
            if [ -f "$(dirname "$link")/$target" ]; then
                cp "$(dirname "$link")/$target" "$link"
            else
                cp "$target" "$link"
            fi
            echo "   Resolved: $link"
        fi
    done
else
    echo "   No symlinks found"
fi

# 5. Normalize all file permissions
echo "5. Normalizing file permissions..."
find . -type f -exec chmod 644 {} +
find . -type d -exec chmod 755 {} +

# 6. Re-apply execute permissions to binaries
echo "6. Setting execute permissions on binaries..."
chmod +x bin/python* bin/2to3* bin/idle3* bin/pydoc3* bin/pip* 2>/dev/null
find lib/python3.12/site-packages -type f -name "*.so" -exec chmod 755 {} \\; 2>/dev/null

echo ""
echo "✓ Python runtime installation and setup complete!"
echo "✓ Runtime is ready for bundling"
echo ""
echo "Location: $RUNTIME_DIR/$ARCH"
\`\`\``;export{n as default};
