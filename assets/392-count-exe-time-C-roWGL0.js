const n=`---
title: Count Execution Time of a Shell Script
date: 2025-04-30
id: blog0392
tag: shell
toc: true
intro: "Code to count the duration of a shell script"
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Helper Functions

#### start_timer

\`\`\`bash
start_time=0

start_timer() {
  echo "Starting $1..."
  start_time=$(date +%s)
}
\`\`\`

#### end_timer

\`\`\`bash
end_timer() {
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  # Format the time nicely
  if [ $duration -ge 3600 ]; then
    local hours=$((duration / 3600))
    local minutes=$(( (duration % 3600) / 60 ))
    local seconds=$((duration % 60))
    echo "$1 completed in \${hours}h \${minutes}m \${seconds}s"
  elif [ $duration -ge 60 ]; then
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    echo "$1 completed in \${minutes}m \${seconds}s"
  else
    echo "$1 completed in \${duration}s"
  fi
}
\`\`\`

### Apply the Functions

\`\`\`bash
start_timer "DB clone"

... # many logic here

end_timer "DB clone"
\`\`\`
`;export{n as default};
