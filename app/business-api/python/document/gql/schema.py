import strawberry

from gql.queries import Query

schema = strawberry.Schema(query=Query)
