cd "$(dirname "$0")"

ARGS=$@

node generate.js

PORT=8000 node http2-server.js &
FAST_SERVE_PID=$!
PORT=8001 CACHE=1 node http2-server.js &
FAST_SERVE_CACHE_PID=$!
PORT=8002 BANDWIDTH=750 LATENCY=25 BROTLI=11 node --max-old-space-size=8000 http2-server.js &
SLOW_SERVE_PID=$!
# PORT=8003 BANDWIDTH=750 LATENCY=25 node --max-old-space-size=8000 http2-server.js &
# SLOW_SERVE_UNCOMPRESSED_PID=$!

ExitNotOk() {
  kill $FAST_SERVE_PID
  kill $FAST_SERVE_CACHE_PID
  kill $SLOW_SERVE_PID
  # kill $SLOW_SERVE_UNCOMPRESSED_PID
  exit 1;
}

ExitOk() {
  kill $FAST_SERVE_PID
  kill $FAST_SERVE_CACHE_PID
  kill $SLOW_SERVE_PID
  # kill $SLOW_SERVE_UNCOMPRESSED_PID
  exit 0;
}

if [ "$#" -eq 0 ]; then
  ARG_LIST=(benchmarks/*)
  ARGS="${ARG_LIST[@]}"
fi

total=$(echo $ARGS | wc -w)
cnt=0

trap ExitNotOk SIGINT SIGTERM SIGTSTP
trap ExitOk EXIT

for bench in $ARGS; do
  if [ "$total" -ne 1 ] && [ -f "results/$(basename $bench .bench.json).csv" ]; then
    echo "Skipping $bench"
  else
    echo "Running benchmark $bench ($cnt / $total)";
    node ../node_modules/tachometer/bin/tach --config $bench --csv-file-raw results/$(basename $bench .bench.json).csv
  fi
  ((cnt++))
done
