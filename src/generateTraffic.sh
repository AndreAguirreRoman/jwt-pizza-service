#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 http://localhost:3000"
  exit 1
fi
host=$1


cleanup() {
  echo ""
  echo "Terminating background processes..."
  kill $pid1 $pid2 $pid3 $pid4 $pid5 $pid6 2>/dev/null
  exit 0
}
trap cleanup SIGINT

execute_curl() {
  echo $(eval "curl -s -o /dev/null -w \"%{http_code}\" $1")
}

login() {
  response=$(curl -s -X PUT $host/api/auth -d "{\"email\":\"$1\", \"password\":\"$2\"}" -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token // empty')
  echo $token
}

register_random_user() {
  email="traffic$(date +%s%N)@jwt.com"
  password="trafficpass"
  name="Traffic User"
  response=$(curl -s -X POST "$host/api/auth" -H 'Content-Type: application/json' -d "{\"name\":\"$name\", \"email\":\"$email\", \"password\":\"$password\"}")
  token=$(echo "$response" | jq -r '.token // empty')
  echo "$token"
}

while true; do
  result=$(execute_curl $host/api/order/menu)
  echo "Requesting menu (GET traffic)..." $result
  sleep 3
done &
pid1=$!

while true; do
  result=$(execute_curl "-X PUT \"$host/api/auth\" -d '{\"email\":\"unknown@jwt.com\", \"password\":\"bad\"}' -H 'Content-Type: application/json'")
  echo "Logging in with invalid credentials (Auth failure)..." $result
  sleep 25
done &
pid2=$!

while true; do
  token=$(login "f@jwt.com" "franchisee")
  echo "Login franchisee (Auth success)..." $( [ -z "$token" ] && echo "false" || echo "true" )
  sleep 110
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out franchisee (Logout traffic)..." $result
  sleep 10
done &
pid3=$!

while true; do
  token=$(login "d@jwt.com" "diner")
  echo "Login diner (Auth success)..." $( [ -z "$token" ] && echo "false" || echo "true" )
  result=$(execute_curl "-X POST $host/api/order -H 'Content-Type: application/json' -d '{\"franchiseId\": 1, \"storeId\":1, \"items\":[{ \"menuId\": 1, \"description\": \"Veggie\", \"price\": 0.05 }]}'  -H \"Authorization: Bearer $token\"")
  echo "Bought a pizza (Pizza success)..." $result
  sleep 20
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out diner (Logout traffic)..." $result
  sleep 30
done &
pid4=$!

while true; do
  token=$(login "d@jwt.com" "diner")
  echo "Login hungry diner (Auth success)..." $( [ -z "$token" ] && echo "false" || echo "true" )

  items='{ "menuId": 1, "description": "Veggie", "price": 0.05 }'
  for (( i=0; i < 21; i++ ))
  do items+=', { "menuId": 1, "description": "Veggie", "price": 0.05 }'
  done
  
  result=$(execute_curl "-X POST $host/api/order -H 'Content-Type: application/json' -d '{\"franchiseId\": 1, \"storeId\":1, \"items\":[$items]}'  -H \"Authorization: Bearer $token\"")
  echo "Bought too many pizzas (Pizza failure)..." $result  
  sleep 5
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out hungry diner (Logout traffic)..." $result
  sleep 295
done &
pid5=$!

while true; do
  for (( i=1; i<=5; i++ ))
  do
    token=$(register_random_user)
    echo "Registering user $i of 5 (Active users)..." $( [ -z "$token" ] && echo "false" || echo "true" )
  done
  sleep 90
done &
pid6=$!

wait $pid1 $pid2 $pid3 $pid4 $pid5 $pid6