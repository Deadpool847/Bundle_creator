from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import json
import zipfile
import tempfile
import shutil
from PIL import Image, ImageEnhance, ImageFilter
import io
import asyncio
from emergentintegrations.llm.chat import LlmChat, UserMessage
import moviepy.editor as mp
from moviepy.video.fx.resize import resize
import numpy as np

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Platform specifications
PLATFORM_SPECS = {
    'redbubble': {
        't_shirts': (2875, 3900),
        'stickers': (2800, 2800),
        'art_prints': (3840, 3840),
        'phone_cases': (1187, 1852),
        'tote_bags': (2400, 3200),
        'posters_small': (4100, 5840),
        'posters_large': (8310, 11790)
    },
    'teepublic': {
        't_shirts': (2875, 3900),
        'stickers': (2800, 2800),
        'art_prints': (3840, 3840)
    },
    'threadless': {
        't_shirts': (3000, 4000),
        'art_prints': (4000, 4000)
    },
    'zazzle': {
        't_shirts': (3000, 4000),
        'products': (3000, 3000)
    },
    'displate': {
        'metal_posters': (4000, 6000)
    },
    'etsy': {
        'listing_photos': (2000, 2000),
        'print_files': (3000, 4000)
    },
    'mobile_wallpapers': {
        'hd': (1080, 1920),
        'qhd': (1440, 2560),
        'uhd': (2160, 3840)
    },
    'desktop_wallpapers': {
        'fhd': (1920, 1080),
        'qhd': (2560, 1440),
        'uhd': (3840, 2160),
        '4k': (4096, 2304)
    }
}

# Define Models
class BundleProject(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    seo_keywords: List[str] = []
    platforms: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "processing"

class BundleProjectCreate(BaseModel):
    name: str
    description: str
    platforms: List[str] = []
    custom_keywords: List[str] = []

class SEOKeywords(BaseModel):
    keywords: List[str]
    title_suggestions: List[str]
    descriptions: List[str]

# Utility functions
def enhance_image_quality(image):
    """Apply intelligent image enhancement"""
    # Enhance sharpness
    enhancer = ImageEnhance.Sharpness(image)
    image = enhancer.enhance(1.2)
    
    # Enhance color saturation
    enhancer = ImageEnhance.Color(image)
    image = enhancer.enhance(1.1)
    
    # Enhance contrast
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(1.05)
    
    return image

def smart_resize_for_platform(image, target_size):
    """Intelligent resizing with aspect ratio preservation"""
    original_width, original_height = image.size
    target_width, target_height = target_size
    
    # Calculate aspect ratios
    original_ratio = original_width / original_height
    target_ratio = target_width / target_height
    
    if original_ratio > target_ratio:
        # Image is wider, fit by height
        new_height = target_height
        new_width = int(target_height * original_ratio)
    else:
        # Image is taller, fit by width
        new_width = target_width
        new_height = int(target_width / original_ratio)
    
    # Resize with high quality
    resized_image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # Create a new image with target dimensions and center the resized image
    final_image = Image.new('RGB', target_size, (255, 255, 255))
    
    # Calculate position to center the image
    x = (target_width - new_width) // 2
    y = (target_height - new_height) // 2
    
    final_image.paste(resized_image, (x, y))
    
    return final_image

async def generate_seo_keywords(project_name: str, description: str, custom_keywords: List[str] = []):
    """Generate SEO optimized keywords using AI"""
    try:
        emergent_key = os.environ.get('EMERGENT_LLM_KEY')
        if not emergent_key:
            # Fallback to basic keywords
            return SEOKeywords(
                keywords=custom_keywords + [project_name.lower(), 'print on demand', 'digital art'],
                title_suggestions=[f"{project_name} Bundle", f"Premium {project_name} Collection"],
                descriptions=[f"High-quality {project_name} bundle ready for print-on-demand platforms"]
            )
        
        chat = LlmChat(
            api_key=emergent_key,
            session_id=f"seo_{uuid.uuid4()}",
            system_message="You are an expert SEO specialist for print-on-demand platforms like Etsy, Redbubble. Generate optimized keywords, titles, and descriptions."
        ).with_model("openai", "gpt-4o-mini")
        
        prompt = f"""
        Project Name: {project_name}
        Description: {description}
        Custom Keywords: {', '.join(custom_keywords)}
        
        Generate SEO-optimized content for print-on-demand platforms:
        1. 20 high-converting keywords (mix of short and long-tail)
        2. 5 compelling title suggestions
        3. 3 product descriptions (short, medium, long)
        
        Focus on: commercial license, instant download, high resolution, print ready
        
        Return as JSON format:
        {
            "keywords": ["keyword1", "keyword2", ...],
            "title_suggestions": ["title1", "title2", ...],
            "descriptions": ["desc1", "desc2", "desc3"]
        }
        """
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        # Parse the JSON response
        try:
            seo_data = json.loads(response)
            return SEOKeywords(**seo_data)
        except:
            # Fallback if JSON parsing fails
            return SEOKeywords(
                keywords=custom_keywords + [project_name.lower(), 'print on demand', 'digital art', 'commercial use', 'instant download'],
                title_suggestions=[f"{project_name} Bundle - Commercial License", f"Premium {project_name} Collection"],
                descriptions=[f"High-quality {project_name} bundle with commercial license. Perfect for print-on-demand platforms."]
            )
            
    except Exception as e:
        logging.error(f"SEO generation error: {e}")
        return SEOKeywords(
            keywords=custom_keywords + [project_name.lower(), 'print on demand', 'digital art'],
            title_suggestions=[f"{project_name} Bundle", f"Premium {project_name} Collection"],
            descriptions=[f"High-quality {project_name} bundle ready for print-on-demand platforms"]
        )

def create_slideshow_video(image_paths, output_path, music_path=None, duration_per_image=3):
    """Create a slideshow video with transitions"""
    try:
        clips = []
        
        for i, img_path in enumerate(image_paths):
            # Load image and create video clip
            img_clip = mp.ImageClip(img_path, duration=duration_per_image)
            
            # Add different transitions
            if i > 0:
                img_clip = img_clip.crossfadein(0.5)
            if i < len(image_paths) - 1:
                img_clip = img_clip.crossfadeout(0.5)
                
            clips.append(img_clip)
        
        # Concatenate all clips
        video = mp.concatenate_videoclips(clips, method="compose")
        
        # Add music if provided
        if music_path and os.path.exists(music_path):
            try:
                audio = mp.AudioFileClip(music_path)
                # Loop or trim audio to match video duration
                if audio.duration > video.duration:
                    audio = audio.subclip(0, video.duration)
                else:
                    # Loop audio if shorter than video
                    loops_needed = int(video.duration / audio.duration) + 1
                    audio = mp.concatenate_audioclips([audio] * loops_needed).subclip(0, video.duration)
                
                video = video.set_audio(audio)
            except Exception as e:
                logging.warning(f"Could not add audio: {e}")
        
        # Write video file
        video.write_videofile(output_path, fps=24, codec='libx264')
        video.close()
        
        return True
    except Exception as e:
        logging.error(f"Video creation error: {e}")
        return False

def generate_license_file():
    """Generate commercial and personal use license"""
    license_text = """
DIGITAL BUNDLE LICENSE AGREEMENT

COMMERCIAL & PERSONAL USE LICENSE

This license grants you the following rights:

WHAT YOU CAN DO:
✓ Use for personal projects and commercial purposes
✓ Print on physical products for resale (t-shirts, mugs, posters, etc.)
✓ Use in your print-on-demand business
✓ Modify, resize, and adapt the designs
✓ Use for client work and commercial projects
✓ Create unlimited physical products

WHAT YOU CANNOT DO:
✗ Resell or redistribute the original digital files
✗ Share the files with others or make them downloadable
✗ Claim ownership or copyright of the designs
✗ Use in trademark or logo applications
✗ Create competing digital products for resale

ATTRIBUTION: Not required but appreciated

This license is valid indefinitely from purchase date.
For questions, contact the seller through your purchase platform.

Generated: {date}
Bundle ID: {bundle_id}
"""
    return license_text

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Bundle Creation API Ready"}

@api_router.post("/bundles/create", response_model=BundleProject)
async def create_bundle_project(project_data: BundleProjectCreate):
    """Create a new bundle project"""
    project = BundleProject(**project_data.dict())
    
    # Generate SEO keywords
    seo_data = await generate_seo_keywords(
        project.name, 
        project.description, 
        project_data.custom_keywords
    )
    project.seo_keywords = seo_data.keywords
    
    # Save to database
    await db.bundle_projects.insert_one(project.dict())
    
    return project

@api_router.post("/bundles/{project_id}/process")
async def process_bundle(
    project_id: str,
    images: List[UploadFile] = File(...),
    music: Optional[UploadFile] = File(None)
):
    """Process images and create the complete bundle"""
    
    # Get project from database
    project = await db.bundle_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    try:
        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Create bundle structure
            bundle_dir = temp_path / "bundle"
            bundle_dir.mkdir()
            
            raw_dir = bundle_dir / "01_Raw_Images"
            platform_dir = bundle_dir / "02_Platform_Ready"
            wallpaper_dir = bundle_dir / "03_Wallpapers"
            video_dir = bundle_dir / "04_Promo_Video"
            
            raw_dir.mkdir()
            platform_dir.mkdir()
            wallpaper_dir.mkdir()
            video_dir.mkdir()
            
            processed_images = []
            
            # Process each uploaded image
            for idx, image_file in enumerate(images):
                # Save original image
                image_data = await image_file.read()
                original_image = Image.open(io.BytesIO(image_data))
                
                # Convert to RGB if necessary
                if original_image.mode != 'RGB':
                    original_image = original_image.convert('RGB')
                
                # Enhance image quality
                enhanced_image = enhance_image_quality(original_image)
                
                # Save enhanced raw image
                raw_filename = f"raw_{idx+1:03d}_{image_file.filename}"
                raw_path = raw_dir / raw_filename
                enhanced_image.save(raw_path, "PNG", quality=100)
                processed_images.append(str(raw_path))
                
                # Create platform-specific versions
                for platform in project['platforms']:
                    if platform in PLATFORM_SPECS:
                        platform_spec_dir = platform_dir / platform
                        platform_spec_dir.mkdir(exist_ok=True)
                        
                        for product_type, dimensions in PLATFORM_SPECS[platform].items():
                            resized_image = smart_resize_for_platform(enhanced_image, dimensions)
                            
                            # Apply additional enhancement for specific products
                            if 'phone' in product_type.lower():
                                # Extra sharpness for mobile displays
                                enhancer = ImageEnhance.Sharpness(resized_image)
                                resized_image = enhancer.enhance(1.3)
                            
                            filename = f"{platform}_{product_type}_{idx+1:03d}.png"
                            file_path = platform_spec_dir / filename
                            resized_image.save(file_path, "PNG", quality=100, dpi=(300, 300))
                
                # Create wallpaper versions
                mobile_dir = wallpaper_dir / "mobile"
                desktop_dir = wallpaper_dir / "desktop"
                mobile_dir.mkdir(exist_ok=True)
                desktop_dir.mkdir(exist_ok=True)
                
                # Mobile wallpapers
                for quality, dimensions in PLATFORM_SPECS['mobile_wallpapers'].items():
                    mobile_image = smart_resize_for_platform(enhanced_image, dimensions)
                    mobile_filename = f"mobile_{quality}_{idx+1:03d}.png"
                    mobile_path = mobile_dir / mobile_filename
                    mobile_image.save(mobile_path, "PNG", quality=100)
                
                # Desktop wallpapers
                for quality, dimensions in PLATFORM_SPECS['desktop_wallpapers'].items():
                    desktop_image = smart_resize_for_platform(enhanced_image, dimensions)
                    desktop_filename = f"desktop_{quality}_{idx+1:03d}.png"
                    desktop_path = desktop_dir / desktop_filename
                    desktop_image.save(desktop_path, "PNG", quality=100)
            
            # Create promo video
            video_output = video_dir / "promo_video.mp4"
            music_path = None
            
            if music:
                music_data = await music.read()
                music_path = temp_path / f"music_{music.filename}"
                with open(music_path, "wb") as f:
                    f.write(music_data)
            
            video_created = create_slideshow_video(
                processed_images[:10],  # Use first 10 images max
                str(video_output),
                str(music_path) if music_path else None
            )
            
            if not video_created:
                # Create a simple text file if video creation fails
                with open(video_dir / "video_creation_failed.txt", "w") as f:
                    f.write("Video creation encountered an issue. Please check the logs.")
            
            # Generate license file
            license_content = generate_license_file().format(
                date=datetime.now().strftime("%Y-%m-%d"),
                bundle_id=project_id
            )
            with open(bundle_dir / "LICENSE.txt", "w") as f:
                f.write(license_content)
            
            # Create SEO keywords file
            seo_file_content = f"""
SEO KEYWORDS AND SUGGESTIONS

Keywords: {', '.join(project['seo_keywords'])}

Title Suggestions:
- {project['name']} Digital Bundle - Commercial License
- Premium {project['name']} Collection for POD
- High-Resolution {project['name']} Art Bundle

Description Templates:
- Short: High-quality {project['name']} bundle with commercial license. Perfect for print-on-demand.
- Medium: Professional {project['name']} digital collection featuring {len(images)} high-resolution designs. Includes commercial license for unlimited use on Etsy, Redbubble, and other POD platforms.
- Long: Complete {project['name']} digital bundle featuring {len(images)} professionally enhanced designs. Each image is optimized for multiple platforms including Redbubble, Etsy, TeePublic, and more. Includes mobile/desktop wallpapers, platform-ready files, and commercial license for unlimited business use. Instant download, print-ready files at 300 DPI.
"""
            with open(bundle_dir / "SEO_KEYWORDS.txt", "w") as f:
                f.write(seo_file_content)
            
            # Create ZIP file
            zip_path = temp_path / f"{project['name']}_bundle.zip"
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file_path in bundle_dir.rglob('*'):
                    if file_path.is_file():
                        arcname = file_path.relative_to(bundle_dir)
                        zipf.write(file_path, arcname)
            
            # Update project status
            await db.bundle_projects.update_one(
                {"id": project_id}, 
                {"$set": {"status": "completed", "completed_at": datetime.utcnow()}}
            )
            
            # Return the ZIP file
            return FileResponse(
                path=str(zip_path),
                filename=f"{project['name']}_bundle.zip",
                media_type="application/zip"
            )
            
    except Exception as e:
        logging.error(f"Bundle processing error: {e}")
        await db.bundle_projects.update_one(
            {"id": project_id}, 
            {"$set": {"status": "failed", "error": str(e)}}
        )
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@api_router.get("/bundles", response_model=List[BundleProject])
async def get_bundle_projects():
    """Get all bundle projects"""
    projects = await db.bundle_projects.find().to_list(1000)
    return [BundleProject(**project) for project in projects]

@api_router.get("/platforms")
async def get_supported_platforms():
    """Get all supported platforms and their specifications"""
    return {
        "platforms": list(PLATFORM_SPECS.keys()),
        "specifications": PLATFORM_SPECS
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()