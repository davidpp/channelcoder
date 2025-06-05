#!/bin/bash
set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="${CLAUDE_AUTH_IMAGE:-my-claude:authenticated}"
BASE_IMAGE="${CLAUDE_BASE_IMAGE:-channelcoder/claude-base}"
VOLUME_NAME="claude-auth-data"
DOCKERFILE_PATH="$(dirname "$0")/Dockerfile.claude"

echo -e "${GREEN}Claude Docker Authentication Setup${NC}"
echo "===================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Check if authenticated image already exists
if docker image inspect "$IMAGE_NAME" > /dev/null 2>&1; then
    echo -e "${YELLOW}Authenticated image '$IMAGE_NAME' already exists.${NC}"
    read -p "Do you want to rebuild it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Using existing image."
        exit 0
    fi
    echo "Removing existing image..."
    docker rmi "$IMAGE_NAME"
fi

# Build base image if needed
if ! docker image inspect "$BASE_IMAGE" > /dev/null 2>&1; then
    echo -e "${GREEN}Building base image from local Dockerfile...${NC}"
    docker build -t "$BASE_IMAGE" -f "$DOCKERFILE_PATH" "$(dirname "$DOCKERFILE_PATH")"
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to build base image${NC}"
        exit 1
    fi
fi

# Create or verify volume exists
echo -e "${GREEN}Setting up persistent volume...${NC}"
docker volume create "$VOLUME_NAME" > /dev/null 2>&1 || true

# Start interactive container for authentication
echo -e "${GREEN}Starting authentication container...${NC}"
echo -e "${YELLOW}Note: The firewall will be disabled during auth setup${NC}"
echo ""

CONTAINER_NAME="claude-auth-setup-$$"

# Run container without the firewall for auth
# Note: We're NOT mounting the volume during auth to ensure tokens are saved in the image
docker run -it --name "$CONTAINER_NAME" \
    --entrypoint /bin/bash \
    "$BASE_IMAGE" -c '
    echo "=== Claude OAuth Authentication ==="
    echo ""
    echo "Starting authentication process..."
    echo "You will need to open the URL in your browser on the host machine."
    echo ""
    
    # Start claude - it will handle auth automatically
    claude
    
    echo ""
    echo "Authentication should be complete now."
    
    echo ""
    echo "Setup complete. Exit this container to save the authenticated state."
    echo "Press Enter to continue..."
    read
'

# Check if container still exists (user might have killed it)
if ! docker ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}Error: Container was terminated unexpectedly${NC}"
    exit 1
fi

# Commit the container to create authenticated image with proper entrypoint
echo -e "${GREEN}Creating authenticated image...${NC}"
# Use the smart entrypoint from the base image
docker commit --change 'ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]' --change 'CMD []' "$CONTAINER_NAME" "$IMAGE_NAME"

# Clean up
echo "Cleaning up temporary container..."
docker rm "$CONTAINER_NAME" > /dev/null

echo ""
echo -e "${GREEN}✓ Authentication complete!${NC}"
echo ""
echo "Your authenticated image is: ${YELLOW}$IMAGE_NAME${NC}"
echo ""
echo -e "${GREEN}Usage Examples:${NC}"
echo ""
echo "1. Interactive shell (for development):"
echo -e "   ${YELLOW}docker run -it --rm -v \$PWD:/workspace $IMAGE_NAME${NC}"
echo ""
echo "2. Run Claude directly:"
echo -e "   ${YELLOW}docker run -it --rm -v \$PWD:/workspace $IMAGE_NAME claude 'Your prompt here'${NC}"
echo ""
echo "3. With firewall enabled (secure mode):"
echo -e "   ${YELLOW}docker run -it --rm -v \$PWD:/workspace $IMAGE_NAME -c 'sudo /usr/local/bin/init-firewall.sh && claude \"Your prompt here\"'${NC}"
echo ""
echo "4. With ChannelCoder SDK:"
echo -e "   ${YELLOW}await claude('Your task', { docker: { image: '$IMAGE_NAME' } })${NC}"
echo ""
echo "5. Quick test:"
echo -e "   ${YELLOW}echo 'test' | docker run -i --rm $IMAGE_NAME claude${NC}"
echo ""
echo -e "${GREEN}Notes:${NC}"
echo "• Auth tokens are baked into the image"
echo "• Firewall must be manually initialized when needed"
echo "• The image supports both interactive and SDK usage"