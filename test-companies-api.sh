#!/bin/bash

# Test script to verify companies API endpoints

BASE_URL="http://localhost:5000"
ADMIN_TOKEN="your_admin_token_here"

echo "========================================="
echo "Testing Companies API Endpoints"
echo "========================================="

# Test 1: GET all companies
echo ""
echo "Test 1: GET /api/admin/companies"
echo "---"
curl -X GET "$BASE_URL/api/admin/companies" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -v

# Test 2: POST create a new company
echo ""
echo ""
echo "Test 2: POST /api/admin/companies (Create Company)"
echo "---"
curl -X POST "$BASE_URL/api/admin/companies" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "Test Company Ltd",
    "description": "A test company for smoke testing",
    "contactEmail": "contact@testcompany.com",
    "phone": "+234 809 000 1234",
    "isActive": true,
    "businessAddress": "123 Test Street",
    "businessCity": "Lagos",
    "businessState": "Lagos",
    "businessZipCode": "100001",
    "businessCountry": "Nigeria",
    "businessType": "Limited Liability Company (LLC)",
    "businessRegNumber": "RC12345",
    "businessTaxId": "TIN123456",
    "bankAccountName": "Test Company Account",
    "bankName": "Zenith Bank",
    "bankAccountNumber": "0123456789",
    "bankRoutingNumber": "000000000"
  }' \
  -v

echo ""
echo ""
echo "========================================="
echo "Tests Complete!"
echo "========================================="
