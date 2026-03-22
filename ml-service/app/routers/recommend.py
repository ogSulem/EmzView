from fastapi import APIRouter

from app.schemas import (
    ForYouRequest,
    ForYouResponse,
    BecauseRequest,
    MoodRequest,
    RecommendResponse,
    SimilarUsersRequest,
    SimilarUsersResponse,
)
from app.services.hybrid import recommend_for_you, recommend_because, recommend_mood, recommend_similar_users

router = APIRouter()


@router.post("/for-you", response_model=ForYouResponse)
def for_you(req: ForYouRequest):
    return recommend_for_you(req)


@router.post("/because", response_model=RecommendResponse)
def because(req: BecauseRequest):
    return recommend_because(req)


@router.post("/mood", response_model=RecommendResponse)
def mood(req: MoodRequest):
    return recommend_mood(req)


@router.post("/similar-users", response_model=SimilarUsersResponse)
def similar_users(req: SimilarUsersRequest):
    return recommend_similar_users(req)
