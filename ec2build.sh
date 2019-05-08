
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
sudo apt install nodejs

sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo service mongod start

mkdir .aws
cd .aws
touch credentials
nano credentials

ssh-keygen
cat ~/.ssh/codecommit_rsa.pub
cd .ssh

git clone ssh://git-codecommit.ap-southeast-1.amazonaws.com/v1/repos/at-todra-data
cd at-todra-data/
npm install