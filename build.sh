VERSION=0.0.3

git-changelog --output CHANGELOG.md

docker build -t studihub/api-upload:${VERSION} .

# sudo docker run -it --network host --restart always --env-file /home/ubuntu/studihub-api/.env studihub/api:0.0.1