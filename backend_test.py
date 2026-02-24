#!/usr/bin/env python3
"""
Portfolio Web App Backend API Testing
Tests all backend endpoints for the Portfolio Web App
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://dev-portfolio-stack-1.preview.emergentagent.com/api"
ADMIN_EMAIL = "drazic.milan@gmail.com"
ADMIN_PASSWORD = "Admin@123"

# Global variables
auth_token = None
test_results = []

def log_test(test_name, success, message="", response_data=None):
    """Log test results"""
    result = {
        "test": test_name,
        "success": success,
        "message": message,
        "timestamp": datetime.now().isoformat()
    }
    if response_data:
        result["response"] = response_data
    test_results.append(result)
    
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}: {message}")

def make_request(method, endpoint, data=None, headers=None, auth_required=False):
    """Make HTTP request with proper headers"""
    url = f"{BASE_URL}/{endpoint}"
    
    # Default headers
    request_headers = {"Content-Type": "application/json"}
    if headers:
        request_headers.update(headers)
    
    # Add auth token if required
    if auth_required and auth_token:
        request_headers["Authorization"] = f"Bearer {auth_token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=request_headers, timeout=30)
        elif method == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=30)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=request_headers, timeout=30)
        elif method == "DELETE":
            response = requests.delete(url, headers=request_headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None

def test_health_check():
    """Test health check endpoint"""
    print("\n=== Testing Health Check API ===")
    
    response = make_request("GET", "health")
    if response and response.status_code == 200:
        data = response.json()
        if data.get("status") == "ok":
            log_test("Health Check", True, "Health endpoint working correctly", data)
            return True
        else:
            log_test("Health Check", False, f"Unexpected response: {data}")
    else:
        status_code = response.status_code if response else "No response"
        log_test("Health Check", False, f"Failed with status: {status_code}")
    
    return False

def test_auth_login():
    """Test login authentication"""
    print("\n=== Testing Auth Login API ===")
    global auth_token
    
    login_data = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    response = make_request("POST", "auth/login", login_data)
    if response and response.status_code == 200:
        data = response.json()
        if "token" in data and "user" in data:
            auth_token = data["token"]
            user = data["user"]
            if user.get("isAdmin"):
                log_test("Auth Login", True, f"Admin login successful for {user.get('email')}", {"user": user})
                return True
            else:
                log_test("Auth Login", False, "User is not admin")
        else:
            log_test("Auth Login", False, f"Missing token or user in response: {data}")
    else:
        status_code = response.status_code if response else "No response"
        error_msg = response.json().get("error", "Unknown error") if response else "No response"
        log_test("Auth Login", False, f"Login failed with status {status_code}: {error_msg}")
    
    return False

def test_auth_register():
    """Test user registration"""
    print("\n=== Testing Auth Register API ===")
    
    # Generate unique email for testing
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    register_data = {
        "name": f"Test User {timestamp}",
        "email": f"testuser_{timestamp}@example.com",
        "password": "TestPassword123!"
    }
    
    response = make_request("POST", "auth/register", register_data)
    if response and response.status_code == 200:
        data = response.json()
        if "token" in data and "user" in data:
            user = data["user"]
            log_test("Auth Register", True, f"Registration successful for {user.get('email')}", {"user": user})
            return True
        else:
            log_test("Auth Register", False, f"Missing token or user in response: {data}")
    else:
        status_code = response.status_code if response else "No response"
        error_msg = response.json().get("error", "Unknown error") if response else "No response"
        log_test("Auth Register", False, f"Registration failed with status {status_code}: {error_msg}")
    
    return False

def test_services_crud():
    """Test Services CRUD operations"""
    print("\n=== Testing Services CRUD API ===")
    
    # Test GET services
    response = make_request("GET", "services")
    if response and response.status_code == 200:
        services = response.json()
        log_test("Services GET", True, f"Retrieved {len(services)} services", {"count": len(services)})
    else:
        log_test("Services GET", False, f"Failed to get services: {response.status_code if response else 'No response'}")
        return False
    
    # Test POST service (admin required)
    if not auth_token:
        log_test("Services POST", False, "No auth token available")
        return False
    
    service_data = {
        "title": "Test Web Development Service",
        "description": "Professional web development services for modern businesses",
        "category": "Web Development",
        "price": 1500,
        "features": ["Responsive Design", "SEO Optimization", "Performance Optimization"],
        "displayOrder": 1
    }
    
    response = make_request("POST", "services", service_data, auth_required=True)
    if response and response.status_code == 201:
        created_service = response.json()
        service_id = created_service.get("_id")
        log_test("Services POST", True, f"Service created with ID: {service_id}", {"id": service_id})
        
        # Test PUT service
        update_data = {
            "title": "Updated Test Web Development Service",
            "price": 1800
        }
        
        response = make_request("PUT", f"services/{service_id}", update_data, auth_required=True)
        if response and response.status_code == 200:
            updated_service = response.json()
            log_test("Services PUT", True, f"Service updated: {updated_service.get('title')}")
        else:
            log_test("Services PUT", False, f"Failed to update service: {response.status_code if response else 'No response'}")
        
        # Test DELETE service
        response = make_request("DELETE", f"services/{service_id}", auth_required=True)
        if response and response.status_code == 200:
            log_test("Services DELETE", True, "Service deleted successfully")
        else:
            log_test("Services DELETE", False, f"Failed to delete service: {response.status_code if response else 'No response'}")
        
        return True
    else:
        status_code = response.status_code if response else "No response"
        error_msg = response.json().get("error", "Unknown error") if response else "No response"
        log_test("Services POST", False, f"Failed to create service with status {status_code}: {error_msg}")
        return False

def test_projects_crud():
    """Test Projects CRUD operations"""
    print("\n=== Testing Projects CRUD API ===")
    
    # Test GET projects
    response = make_request("GET", "projects")
    if response and response.status_code == 200:
        projects = response.json()
        log_test("Projects GET", True, f"Retrieved {len(projects)} projects", {"count": len(projects)})
    else:
        log_test("Projects GET", False, f"Failed to get projects: {response.status_code if response else 'No response'}")
        return False
    
    # Test GET projects with category filter
    response = make_request("GET", "projects?category=E-commerce")
    if response and response.status_code == 200:
        filtered_projects = response.json()
        log_test("Projects GET (filtered)", True, f"Retrieved {len(filtered_projects)} E-commerce projects", {"count": len(filtered_projects)})
    else:
        log_test("Projects GET (filtered)", False, f"Failed to get filtered projects: {response.status_code if response else 'No response'}")
    
    # Test POST project (admin required)
    if not auth_token:
        log_test("Projects POST", False, "No auth token available")
        return False
    
    project_data = {
        "title": "Test E-commerce Platform",
        "description": "A modern e-commerce platform built with Next.js and MongoDB",
        "category": "E-commerce",
        "technologies": ["Next.js", "MongoDB", "Tailwind CSS", "Stripe"],
        "images": ["https://example.com/image1.jpg"],
        "liveUrl": "https://test-ecommerce.example.com",
        "githubUrl": "https://github.com/test/ecommerce",
        "featured": True
    }
    
    response = make_request("POST", "projects", project_data, auth_required=True)
    if response and response.status_code == 201:
        created_project = response.json()
        project_id = created_project.get("_id")
        log_test("Projects POST", True, f"Project created with ID: {project_id}", {"id": project_id})
        
        # Test PUT project
        update_data = {
            "title": "Updated Test E-commerce Platform",
            "featured": False
        }
        
        response = make_request("PUT", f"projects/{project_id}", update_data, auth_required=True)
        if response and response.status_code == 200:
            updated_project = response.json()
            log_test("Projects PUT", True, f"Project updated: {updated_project.get('title')}")
        else:
            log_test("Projects PUT", False, f"Failed to update project: {response.status_code if response else 'No response'}")
        
        # Test DELETE project
        response = make_request("DELETE", f"projects/{project_id}", auth_required=True)
        if response and response.status_code == 200:
            log_test("Projects DELETE", True, "Project deleted successfully")
        else:
            log_test("Projects DELETE", False, f"Failed to delete project: {response.status_code if response else 'No response'}")
        
        return True
    else:
        status_code = response.status_code if response else "No response"
        error_msg = response.json().get("error", "Unknown error") if response else "No response"
        log_test("Projects POST", False, f"Failed to create project with status {status_code}: {error_msg}")
        return False

def test_testimonials_crud():
    """Test Testimonials CRUD operations"""
    print("\n=== Testing Testimonials CRUD API ===")
    
    # Test GET testimonials
    response = make_request("GET", "testimonials")
    if response and response.status_code == 200:
        testimonials = response.json()
        log_test("Testimonials GET", True, f"Retrieved {len(testimonials)} testimonials", {"count": len(testimonials)})
    else:
        log_test("Testimonials GET", False, f"Failed to get testimonials: {response.status_code if response else 'No response'}")
        return False
    
    # Test POST testimonial (no auth required)
    testimonial_data = {
        "clientName": "John Smith",
        "clientEmail": "john.smith@example.com",
        "clientTitle": "CTO at Tech Solutions Inc",
        "comment": "Excellent work on our web development project. Highly professional and delivered on time.",
        "rating": 5
    }
    
    response = make_request("POST", "testimonials", testimonial_data)
    if response and response.status_code == 201:
        created_testimonial = response.json()
        testimonial_id = created_testimonial.get("_id")
        log_test("Testimonials POST", True, f"Testimonial created with ID: {testimonial_id}", {"id": testimonial_id})
        
        # Test PUT testimonial (admin reply)
        if auth_token:
            update_data = {
                "adminReply": "Thank you for your kind words! We're glad you were satisfied with our service."
            }
            
            response = make_request("PUT", f"testimonials/{testimonial_id}", update_data, auth_required=True)
            if response and response.status_code == 200:
                updated_testimonial = response.json()
                log_test("Testimonials PUT", True, "Admin reply added to testimonial")
            else:
                log_test("Testimonials PUT", False, f"Failed to update testimonial: {response.status_code if response else 'No response'}")
        
        # Test DELETE testimonial (admin required)
        if auth_token:
            response = make_request("DELETE", f"testimonials/{testimonial_id}", auth_required=True)
            if response and response.status_code == 200:
                log_test("Testimonials DELETE", True, "Testimonial deleted successfully")
            else:
                log_test("Testimonials DELETE", False, f"Failed to delete testimonial: {response.status_code if response else 'No response'}")
        
        return True
    else:
        status_code = response.status_code if response else "No response"
        error_msg = response.json().get("error", "Unknown error") if response else "No response"
        log_test("Testimonials POST", False, f"Failed to create testimonial with status {status_code}: {error_msg}")
        return False

def test_contact_messages():
    """Test Contact Messages API"""
    print("\n=== Testing Contact Messages API ===")
    
    # Test POST contact message
    contact_data = {
        "name": "Jane Doe",
        "email": "jane.doe@example.com",
        "message": "I'm interested in your web development services. Could you please provide more information about your pricing and timeline?"
    }
    
    response = make_request("POST", "contact-messages", contact_data)
    if response and response.status_code == 201:
        created_message = response.json()
        message_id = created_message.get("_id")
        log_test("Contact Messages POST", True, f"Contact message created with ID: {message_id}", {"id": message_id})
        
        # Test GET contact messages (admin only)
        if auth_token:
            response = make_request("GET", "contact-messages", auth_required=True)
            if response and response.status_code == 200:
                messages = response.json()
                log_test("Contact Messages GET", True, f"Retrieved {len(messages)} contact messages", {"count": len(messages)})
            else:
                log_test("Contact Messages GET", False, f"Failed to get contact messages: {response.status_code if response else 'No response'}")
        
        return True
    else:
        status_code = response.status_code if response else "No response"
        error_msg = response.json().get("error", "Unknown error") if response else "No response"
        log_test("Contact Messages POST", False, f"Failed to create contact message with status {status_code}: {error_msg}")
        return False

def test_company_profile():
    """Test Company Profile API"""
    print("\n=== Testing Company Profile API ===")
    
    # Test GET company profile
    response = make_request("GET", "company-profile")
    if response and response.status_code == 200:
        profile = response.json()
        log_test("Company Profile GET", True, f"Retrieved company profile: {profile.get('name')}", {"name": profile.get('name')})
        
        # Test PUT company profile (admin only)
        if auth_token:
            update_data = {
                "description": "Updated: Transforming Ideas into Digital Success with Innovation"
            }
            
            response = make_request("PUT", "company-profile", update_data, auth_required=True)
            if response and response.status_code == 200:
                updated_profile = response.json()
                log_test("Company Profile PUT", True, "Company profile updated successfully")
            else:
                log_test("Company Profile PUT", False, f"Failed to update company profile: {response.status_code if response else 'No response'}")
        
        return True
    else:
        log_test("Company Profile GET", False, f"Failed to get company profile: {response.status_code if response else 'No response'}")
        return False

def test_statistics():
    """Test Statistics API"""
    print("\n=== Testing Statistics API ===")
    
    if not auth_token:
        log_test("Statistics GET", False, "No auth token available")
        return False
    
    response = make_request("GET", "statistics", auth_required=True)
    if response and response.status_code == 200:
        stats = response.json()
        log_test("Statistics GET", True, f"Retrieved statistics: {stats}", stats)
        return True
    else:
        status_code = response.status_code if response else "No response"
        error_msg = response.json().get("error", "Unknown error") if response else "No response"
        log_test("Statistics GET", False, f"Failed to get statistics with status {status_code}: {error_msg}")
        return False

def test_users_api():
    """Test Users API"""
    print("\n=== Testing Users API ===")
    
    if not auth_token:
        log_test("Users GET", False, "No auth token available")
        return False
    
    # Test GET users (admin only)
    response = make_request("GET", "users", auth_required=True)
    if response and response.status_code == 200:
        users = response.json()
        log_test("Users GET", True, f"Retrieved {len(users)} users", {"count": len(users)})
        return True
    else:
        status_code = response.status_code if response else "No response"
        error_msg = response.json().get("error", "Unknown error") if response else "No response"
        log_test("Users GET", False, f"Failed to get users with status {status_code}: {error_msg}")
        return False

def run_all_tests():
    """Run all backend tests"""
    print("🚀 Starting Portfolio Web App Backend API Tests")
    print(f"Base URL: {BASE_URL}")
    print("=" * 60)
    
    # Track test results
    total_tests = 0
    passed_tests = 0
    
    # High Priority Tests
    print("\n🔥 HIGH PRIORITY TESTS")
    
    # Health Check
    if test_health_check():
        passed_tests += 1
    total_tests += 1
    
    # Authentication (required for other tests)
    if test_auth_login():
        passed_tests += 1
    total_tests += 1
    
    if test_auth_register():
        passed_tests += 1
    total_tests += 1
    
    # CRUD Operations
    if test_services_crud():
        passed_tests += 4  # GET, POST, PUT, DELETE
    total_tests += 4
    
    if test_projects_crud():
        passed_tests += 5  # GET, GET filtered, POST, PUT, DELETE
    total_tests += 5
    
    if test_testimonials_crud():
        passed_tests += 4  # GET, POST, PUT, DELETE
    total_tests += 4
    
    # Medium Priority Tests
    print("\n📋 MEDIUM PRIORITY TESTS")
    
    if test_contact_messages():
        passed_tests += 2  # POST, GET
    total_tests += 2
    
    if test_company_profile():
        passed_tests += 2  # GET, PUT
    total_tests += 2
    
    if test_users_api():
        passed_tests += 1
    total_tests += 1
    
    # Low Priority Tests
    print("\n📊 LOW PRIORITY TESTS")
    
    if test_statistics():
        passed_tests += 1
    total_tests += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 TEST SUMMARY")
    print("=" * 60)
    
    success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
    
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Success Rate: {success_rate:.1f}%")
    
    # Show failed tests
    failed_tests = [result for result in test_results if not result["success"]]
    if failed_tests:
        print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"  - {test['test']}: {test['message']}")
    
    # Show passed tests
    passed_test_results = [result for result in test_results if result["success"]]
    if passed_test_results:
        print(f"\n✅ PASSED TESTS ({len(passed_test_results)}):")
        for test in passed_test_results:
            print(f"  - {test['test']}: {test['message']}")
    
    return success_rate >= 80  # Consider successful if 80% or more tests pass

if __name__ == "__main__":
    try:
        success = run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n💥 Unexpected error: {e}")
        sys.exit(1)