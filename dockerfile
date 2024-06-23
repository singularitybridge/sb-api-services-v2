# Use an official Node.js runtime as a parent image
FROM node:21-slim

# Update CA certificates
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install any dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Run the app when the container launches
CMD ["npm", "run", "start"]
