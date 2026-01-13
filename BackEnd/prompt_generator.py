from typing import Optional
import logging
import os
from anthropic import Anthropic
import openai
from dotenv import load_dotenv
import asyncio
from fastapi import HTTPException

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class PromptGenerator:
    def __init__(self):
        """Initialize prompt generator with API keys"""
        self.anthropic = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.openai_client = openai.OpenAI(api_key=os.getenv("DEEPSEEK_API_KEY"))
        self.claude_model = "claude-3-opus-20240229"
        self.max_retries = 3
        self.retry_delay = 2  # seconds

    async def generate_interview_prompt(self, resume: str, job_description: str) -> str:
        """Generate interview prompt using Deepseek with Claude fallback"""
        logger.info("Starting prompt generation")
        try:
            # Try Deepseek first
            logger.info("Attempting Deepseek generation")
            prompt = await self._generate_with_deepseek(resume, job_description)
            if prompt:
                return prompt
                
            # If Deepseek fails, fall back to Claude with retries
            logger.info("Deepseek failed, falling back to Claude")
            for attempt in range(self.max_retries):
                try:
                    logger.info(f"Claude attempt {attempt + 1}/{self.max_retries}")
                    return await self._generate_with_claude(resume, job_description)
                except Exception as e:
                    if "overloaded" in str(e).lower():
                        if attempt < self.max_retries - 1:
                            wait_time = self.retry_delay * (attempt + 1)
                            logger.warning(f"Claude overloaded, retrying in {wait_time}s (attempt {attempt + 1}/{self.max_retries})")
                            await asyncio.sleep(wait_time)
                            continue
                    logger.error(f"Claude generation failed: {e}")
                    raise
                    
        except Exception as e:
            logger.error(f"Prompt generation failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to generate interview prompt")

    async def _generate_with_deepseek(self, resume: str, job_description: str) -> Optional[str]:
        """Generate prompt using Deepseek"""
        system_prompt = """
            Create me a prompt in this exact format and fill in the square brackets
            with the appropriate information based on the resume and job description:
            "You are Noah, a professional interviewer conducting a job interview.
            IMPORTANT ROLE INSTRUCTIONS:
            - You are ALWAYS the interviewer, never the interviewee
            - You must ONLY speak as Noah the interviewer
            - Never respond as if you are the candidate
            - Never pretend to be the person being interviewed
            - Always ask questions and respond from the interviewer's perspective

            Your task is to interview a candidate named [CANDIDATE NAME] for a position at [COMPANY NAME] in a virtual interview.
            The job description is: [SUMMARIZE THE JOB DESCRIPTION GREATLY]
            The candidate's background: [SUMMARIZE THE CANDIDATE'S EXPERIENCE GREATLY]

            Interview guidance:
            - Begin with a friendly introduction as Noah the interviewer
            - Ask questions naturally as part of the conversation
            - Balance follow-ups with progression to new topics
            - Focus on their experience and qualifications
            - Assess their fit for the role

            Question topics to cover:
            [BEHAVIORAL QUESTION ABOUT RESUME EXPERIENCE]
            [ROLE-SPECIFIC QUESTION FROM JOB DESC]
            [TECHNICAL QUESTION RELEVANT TO ROLE]
            [CULTURE FIT QUESTION]
            [PROBLEM-SOLVING SCENARIO]
            [PAST EXPERIENCE DEEP DIVE]
            [HYPOTHETICAL SITUATION QUESTION]
            [CAREER GOALS QUESTION]

            IMPORTANT FORMAT RULES:
            - Do not use quotation marks or colons in responses
            - Do not number questions
            - Do not prefix responses with 'Noah:'
            - Speak naturally as the interviewer
            - Never switch perspectives to the candidate's side
            - ALWAYS end your responses with a question
            - Balance between follow-up and new topic questions (unless clarity  is crucial)
            - Never end with just a statement
            """

        try:
            response = await self.openai_client.chat.completions.create(
                model="deepseek-coder",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Resume:\n{resume}\n\nJob Description:\n{job_description}"}
                ],
                temperature=0.7,
                max_tokens=2000
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.warning(f"Deepseek generation failed: {e}")
            return None

    async def _generate_with_claude(self, resume: str, job_description: str) -> str:
        """Generate prompt using Claude as fallback"""
        try:
            system_prompt = """
            Create me a prompt in this exact format and fill in the square brackets
            with the appropriate information based on the resume and job description:
            "You are Noah, a professional interviewer conducting a job interview.
            IMPORTANT ROLE INSTRUCTIONS:
            - You are ALWAYS the interviewer, never the interviewee
            - You must ONLY speak as Noah the interviewer
            - Never respond as if you are the candidate
            - Never pretend to be the person being interviewed
            - Always ask questions and respond from the interviewer's perspective

            Your task is to interview a candidate named [CANDIDATE NAME] for a position at [COMPANY NAME] in a virtual interview.
            The job description is: [SUMMARIZE THE JOB DESCRIPTION GREATLY]
            The candidate's background: [SUMMARIZE THE CANDIDATE'S EXPERIENCE GREATLY]

            Interview guidance:
            - Begin with a friendly introduction as Noah the interviewer
            - Ask questions naturally as part of the conversation
            - Balance follow-ups with progression to new topics
            - Focus on their experience and qualifications
            - Assess their fit for the role

            Question topics to cover:
            [BEHAVIORAL QUESTION ABOUT RESUME EXPERIENCE]
            [ROLE-SPECIFIC QUESTION FROM JOB DESC]
            [TECHNICAL QUESTION RELEVANT TO ROLE]
            [CULTURE FIT QUESTION]
            [PROBLEM-SOLVING SCENARIO]
            [PAST EXPERIENCE DEEP DIVE]
            [HYPOTHETICAL SITUATION QUESTION]
            [CAREER GOALS QUESTION]

            IMPORTANT FORMAT RULES:
            - Do not use quotation marks or colons in responses
            - Do not number questions
            - Do not prefix responses with 'Noah:'
            - Speak naturally as the interviewer
            - Never switch perspectives to the candidate's side
            - ALWAYS end your responses with a question
            - Balance between follow-up and new topic questions (unless clarity  is crucial)
            - Never end with just a statement
            """

            response = self.anthropic.messages.create(
                model=self.claude_model,
                max_tokens=2000,
                system=system_prompt,
                messages=[{
                    "role": "user",
                    "content": f"Resume:\n{resume}\n\nJob Description:\n{job_description}"
                }]
            )
            if response.content and len(response.content) > 0:
                return response.content[0].text
            raise ValueError("No content in Claude response")
        except Exception as e:
            logger.error(f"Claude generation failed: {e}")
            raise