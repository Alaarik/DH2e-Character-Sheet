#!/bin/bash

COMPARTMENT_ID="ocid1.tenancy.oc1..aaaaaaaankijb676o3tmart7rkm3va3ak6i4gjxaghtux6laqexmstfhfjqa"
AVAILABILITY_DOMAIN="wqoi:US-CHICAGO-1-AD-3"
IMAGE_ID="ocid1.image.oc1.us-chicago-1.aaaaaaaaol7tabwitv6c7zizomgfsao3cvyf4fl6jcjbv2hpx27h5uuo2cla"
SUBNET_ID="ocid1.subnet.oc1.us-chicago-1.aaaaaaaatvvjbaccrpst3aghh67rci5yv6imkud6ffs6ih2xjbcr5qvtvzwa"
SHAPE="VM.Standard.A1.Flex"
SSH_KEY_FILE="$HOME/.ssh/id_rsa.pub"
DISPLAY_NAME="my-free-instance"
OCPUS=2
MEMORY_GB=12

ATTEMPT=1

while true; do
    echo "$(date) — Attempt $ATTEMPT"
    
    oci compute instance launch \
        --compartment-id "$COMPARTMENT_ID" \
        --availability-domain "$AVAILABILITY_DOMAIN" \
        --shape "$SHAPE" \
        --image-id "$IMAGE_ID" \
        --subnet-id "$SUBNET_ID" \
        --display-name "$DISPLAY_NAME" \
        --shape-config "{\"ocpus\": $OCPUS, \"memoryInGBs\": $MEMORY_GB}" \
        --ssh-authorized-keys-file "$SSH_KEY_FILE" \
        --assign-public-ip true \
        2>&1 | tee /tmp/oci_result.txt

    if grep -q '"lifecycle-state": "PROVISIONING"' /tmp/oci_result.txt; then
        echo "SUCCESS! Instance is provisioning!"
        break
    fi

    echo "Failed. Retrying in 60 seconds..."
    ATTEMPT=$((ATTEMPT + 1))
    sleep 60
done
