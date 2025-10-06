import requests
import sys
import json
import io
from datetime import datetime
from PIL import Image
import tempfile
import os

class BundleCreatorAPITester:
    def __init__(self, base_url="https://design-bundle-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.project_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {}
        
        if data and not files:
            headers['Content-Type'] = 'application/json'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files)
                else:
                    response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    if response.headers.get('content-type', '').startswith('application/json'):
                        return success, response.json()
                    else:
                        return success, response.content
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Raw response: {response.text[:200]}")

            return success, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def create_test_image(self, width=800, height=600, color=(255, 0, 0)):
        """Create a test image in memory"""
        image = Image.new('RGB', (width, height), color)
        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        return img_buffer

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_platforms_endpoint(self):
        """Test platforms specifications endpoint"""
        success, response = self.run_test(
            "Platforms Specifications",
            "GET",
            "platforms",
            200
        )
        
        if success and response:
            print(f"   Found platforms: {list(response.get('platforms', []))}")
            expected_platforms = ['redbubble', 'teepublic', 'threadless', 'zazzle', 'displate', 'etsy', 'mobile_wallpapers', 'desktop_wallpapers']
            actual_platforms = response.get('platforms', [])
            
            if all(platform in actual_platforms for platform in expected_platforms):
                print("   ✅ All expected platforms found")
            else:
                print(f"   ⚠️  Missing platforms: {set(expected_platforms) - set(actual_platforms)}")
        
        return success

    def test_create_bundle_project(self):
        """Test bundle project creation"""
        project_data = {
            "name": f"Test Bundle {datetime.now().strftime('%H%M%S')}",
            "description": "Test bundle for API testing",
            "platforms": ["redbubble", "etsy", "mobile_wallpapers"],
            "custom_keywords": ["test", "digital art", "commercial use"]
        }

        success, response = self.run_test(
            "Create Bundle Project",
            "POST",
            "bundles/create",
            200,
            data=project_data
        )
        
        if success and response:
            self.project_id = response.get('id')
            print(f"   Created project ID: {self.project_id}")
            
            # Verify response structure
            required_fields = ['id', 'name', 'description', 'platforms', 'seo_keywords', 'status']
            missing_fields = [field for field in required_fields if field not in response]
            
            if not missing_fields:
                print("   ✅ All required fields present in response")
            else:
                print(f"   ⚠️  Missing fields: {missing_fields}")
                
            # Check if SEO keywords were generated
            if response.get('seo_keywords'):
                print(f"   ✅ SEO keywords generated: {len(response['seo_keywords'])} keywords")
            else:
                print("   ⚠️  No SEO keywords generated")
        
        return success

    def test_get_bundle_projects(self):
        """Test getting all bundle projects"""
        success, response = self.run_test(
            "Get Bundle Projects",
            "GET",
            "bundles",
            200
        )
        
        if success and response:
            print(f"   Found {len(response)} projects")
            if self.project_id:
                project_found = any(p.get('id') == self.project_id for p in response)
                if project_found:
                    print("   ✅ Created project found in list")
                else:
                    print("   ⚠️  Created project not found in list")
        
        return success

    def test_process_bundle_invalid_project(self):
        """Test processing bundle with invalid project ID"""
        # Create test images
        test_image1 = self.create_test_image(800, 600, (255, 0, 0))
        test_image2 = self.create_test_image(600, 800, (0, 255, 0))
        
        files = {
            'images': ('test1.png', test_image1, 'image/png'),
        }
        
        success, response = self.run_test(
            "Process Bundle - Invalid Project ID",
            "POST",
            "bundles/invalid-id/process",
            404,
            files=files
        )
        
        return success

    def test_process_bundle_valid_project(self):
        """Test processing bundle with valid project ID"""
        if not self.project_id:
            print("❌ Skipping - No valid project ID available")
            return False
            
        # Create test images
        test_image1 = self.create_test_image(800, 600, (255, 0, 0))
        test_image2 = self.create_test_image(600, 800, (0, 255, 0))
        
        files = [
            ('images', ('test1.png', test_image1, 'image/png')),
            ('images', ('test2.png', test_image2, 'image/png'))
        ]
        
        success, response = self.run_test(
            "Process Bundle - Valid Project",
            "POST",
            f"bundles/{self.project_id}/process",
            200,
            files=files
        )
        
        if success:
            print("   ✅ Bundle processing completed successfully")
            if isinstance(response, bytes) and len(response) > 0:
                print(f"   ✅ ZIP file generated: {len(response)} bytes")
            else:
                print("   ⚠️  No ZIP file content received")
        
        return success

    def test_create_bundle_validation(self):
        """Test bundle creation validation"""
        # Test missing required fields
        invalid_data = {
            "description": "Missing name field",
            "platforms": ["redbubble"]
        }

        success, response = self.run_test(
            "Create Bundle - Missing Name",
            "POST",
            "bundles/create",
            422,  # Validation error
            data=invalid_data
        )
        
        return success

def main():
    print("🚀 Starting Bundle Creator API Tests")
    print("=" * 50)
    
    tester = BundleCreatorAPITester()
    
    # Run all tests
    tests = [
        tester.test_root_endpoint,
        tester.test_platforms_endpoint,
        tester.test_create_bundle_project,
        tester.test_get_bundle_projects,
        tester.test_create_bundle_validation,
        tester.test_process_bundle_invalid_project,
        tester.test_process_bundle_valid_project,
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
            tester.tests_run += 1
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())